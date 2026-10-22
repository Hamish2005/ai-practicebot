import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const blobs = vi.hoisted(() => {
  let version = 0;
  const records = new Map<
    string,
    { data: unknown; etag: string; metadata: object }
  >();
  return {
    records,
    getWithMetadata: vi.fn(async (id: string) =>
      structuredClone(records.get(id) ?? null),
    ),
    setJSON: vi.fn(
      async (
        id: string,
        data: unknown,
        options: { onlyIfNew?: boolean; onlyIfMatch?: string },
      ) => {
        const old = records.get(id);
        if (
          (options.onlyIfNew && old) ||
          (options.onlyIfMatch && old?.etag !== options.onlyIfMatch)
        )
          return { modified: false };
        const etag = String(++version);
        records.set(id, { data: structuredClone(data), etag, metadata: {} });
        return { modified: true, etag };
      },
    ),
    delete: vi.fn(async (id: string) => {
      records.delete(id);
    }),
    list: async function* () {
      yield {
        blobs: [...records.keys()].map((key) => ({ key })),
        directories: [],
      };
    },
  };
});
vi.mock("@netlify/blobs", () => ({ getStore: () => blobs }));
vi.mock("../src/server/realtime", () => ({
  liveGreeting: "Hello, how are you?",
  connectRealtime: vi.fn().mockResolvedValue("answer-sdp"),
}));
vi.mock("../src/server/config", async () => {
  const { fakeProvider } = await import("../src/providers/fake");
  return { getProvider: () => fakeProvider };
});
import { NextRequest } from "next/server";
import { POST as sessionPost, GET } from "../src/app/api/session/route";
import { POST as livePost } from "../src/app/api/live/route";
import { sessions } from "../src/server/store";
import {
  createSharedSessionStorage,
  LEASE_TTL,
  SESSION_TTL,
  COMPLETED_TTL,
} from "../src/server/session-storage";
import { startSession } from "../src/engine/session";
import { duplicateCharge } from "../src/scenarios/duplicate-charge";

function request(path: string, body?: unknown, id?: string) {
  return new NextRequest(`https://practice.example/api/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      origin: "https://practice.example",
      ...(id ? { cookie: `practice_session=${id}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function seed() {
  const storage = createSharedSessionStorage();
  await storage.create({
    state: startSession(duplicateCharge, "sample", Date.now()),
    scenario: duplicateCharge,
    touchedAt: Date.now(),
    busy: false,
  });
  return storage;
}
beforeEach(() => {
  blobs.records.clear();
  vi.clearAllMocks();
  vi.stubEnv("SESSION_STORAGE", "netlify");
  vi.stubEnv("AI_PROVIDER", "openai");
  vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
  sessions.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("shared temporary sessions", () => {
  it("restores, connects and ends live voice with no process-local session state", async () => {
    const started = await sessionPost(request("session", { action: "start" }));
    expect(started.status).toBe(200);
    const { session } = await started.json();
    expect(started.headers.get("set-cookie")).toContain("HttpOnly");
    expect(sessions.size).toBe(0);
    const connected = await livePost(
      request(
        "live",
        { action: "connect", sessionId: session.id, revision: 0, sdp: "offer" },
        session.id,
      ),
    );
    expect(connected.status).toBe(200);
    const { liveId } = await connected.json();
    const events = [
      {
        id: "u1",
        role: "user",
        content: "That is frustrating, I can give you your money back",
      },
    ];
    const command = { action: "end", sessionId: session.id, liveId, events };
    const ended = await livePost(request("live", command, session.id));
    expect(ended.status).toBe(200);
    const result = await ended.json();
    expect(result.session.feedback.assessments).toHaveLength(5);
    expect(result.session.turns).toBe(1);
    const retry = await livePost(request("live", command, session.id));
    expect((await retry.json()).session).toEqual(result.session);
    const restored = await GET(request("session", undefined, session.id));
    expect((await restored.json()).session.feedback).toEqual(
      result.session.feedback,
    );
    expect(sessions.size).toBe(0);
  });
  it("allows only one of two independent instances to claim the same version", async () => {
    const first = await seed();
    const second = createSharedSessionStorage();
    const a = (await first.get("sample"))!;
    const b = (await second.get("sample"))!;
    expect(await first.lock(a)).toBe(true);
    expect(await second.lock(b)).toBe(false);
    a.state.revision++;
    await first.release(a);
    expect((await second.get("sample"))!.state.revision).toBe(1);
  });
  it("recovers an abandoned lease and rejects a late write from its previous owner", async () => {
    vi.useFakeTimers();
    const first = await seed();
    const second = createSharedSessionStorage();
    const a = (await first.get("sample"))!;
    await first.lock(a);
    vi.advanceTimersByTime(LEASE_TTL + 1);
    const b = (await second.get("sample"))!;
    expect(await second.lock(b)).toBe(true);
    b.state.revision = 2;
    await second.release(b);
    a.state.revision = 99;
    await expect(first.release(a)).rejects.toThrow("Session changed");
    expect((await second.get("sample"))!.state.revision).toBe(2);
  });
  it("physically removes idle and completed sessions, preserving active sessions", async () => {
    vi.useFakeTimers();
    const store = await seed();
    const entry = (await store.get("sample"))!;
    await store.lock(entry);
    entry.state.endedAt = Date.now();
    await store.release(entry);
    vi.advanceTimersByTime(COMPLETED_TTL + 1);
    await store.cleanup();
    expect(blobs.records.size).toBe(0);
    await seed();
    await store.cleanup();
    expect(blobs.records.size).toBe(1);
    vi.advanceTimersByTime(SESSION_TTL + 1);
    expect(await store.get("sample")).toBeUndefined();
    expect(blobs.records.size).toBe(1);
    await store.cleanup();
    expect(blobs.records.size).toBe(0);
  });
  it("does not report storage outages as expired sessions or expose service errors", async () => {
    blobs.getWithMetadata.mockRejectedValueOnce(
      new Error("private service details"),
    );
    const result = await GET(request("session", undefined, "sample"));
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("private service details");
  });
  it("never reports a successful update if the shared write fails", async () => {
    await seed();
    blobs.setJSON.mockRejectedValueOnce(new Error("write unavailable"));
    const result = await livePost(
      request(
        "live",
        { action: "connect", sessionId: "sample", revision: 0, sdp: "offer" },
        "sample",
      ),
    );
    expect(result.status).toBe(503);
  });
});
