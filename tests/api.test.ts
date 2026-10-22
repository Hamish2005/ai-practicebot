import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/session/route";
import { sessions } from "../src/server/store";

function request(
  body?: unknown,
  id?: string,
  origin = "http://localhost:3000",
) {
  return new NextRequest("http://localhost:3000/api/session", {
    method: body ? "POST" : "GET",
    headers: { origin, ...(id ? { cookie: `practice_session=${id}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function start() {
  const response = await POST(request({ action: "start" }));
  return (await response.json()).session;
}
beforeEach(() => {
  sessions.clear();
  vi.stubEnv("AI_PROVIDER", "fake");
  vi.stubEnv("NODE_ENV", "test");
});

describe("server session boundary", () => {
  it("creates and restores a cookie-owned session without trainer data in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const state = await start();
    expect(state.trainer).toBeNull();
    expect(state.objectives).toBeUndefined();
    expect(
      (await (await GET(request(undefined, state.id))).json()).session.id,
    ).toBe(state.id);
    expect((await (await GET(request())).json()).session).toBeNull();
  });
  it("rejects browser-supplied scores and cross-origin writes", async () => {
    expect(
      (await POST(request({ action: "start", objectives: [] }))).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request({ action: "start" }, undefined, "https://untrusted.example"),
        )
      ).status,
    ).toBe(403);
  });
  it("returns an expired-session error", async () => {
    expect(
      (
        await POST(
          request({ action: "turn", message: "Hello", revision: 0 }, "missing"),
        )
      ).status,
    ).toBe(410);
  });
  it("does not double-count retries after a committed turn", async () => {
    const state = await start();
    const command = { action: "turn", message: "I will fix it.", revision: 0 };
    const first = await (await POST(request(command, state.id))).json();
    const retried = await (await POST(request(command, state.id))).json();
    expect(first.session.turns).toBe(1);
    expect(retried.session).toEqual(first.session);
  });
  it("rejects a future revision or a concurrent request", async () => {
    const state = await start();
    expect(
      (await POST(request({ action: "end", revision: 99 }, state.id))).status,
    ).toBe(409);
    sessions.get(state.id)!.busy = true;
    expect(
      (await POST(request({ action: "end", revision: 0 }, state.id))).status,
    ).toBe(409);
  });
  it("ends manually with complete feedback and no additional messages", async () => {
    const state = await start();
    const ended = (
      await (
        await POST(request({ action: "end", revision: 0 }, state.id))
      ).json()
    ).session;
    expect(ended.feedback.reason).toBe("complete_user");
    expect(ended.feedback.assessments).toHaveLength(5);
    const after = (
      await (
        await POST(
          request({ action: "turn", revision: 1, message: "Hello" }, state.id),
        )
      ).json()
    ).session;
    expect(after.transcript).toHaveLength(1);
  });
  it("reports missing OpenAI configuration without silently selecting fake mode", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(request({ action: "start" }));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("OPENAI_API_KEY");
    expect(sessions.size).toBe(0);
  });
  it("returns and preserves category scores after a learner ends early", async () => {
    const state = await start();
    await POST(
      request(
        {
          action: "turn",
          message: "That is frustrating, I can give you your money back",
          revision: 0,
        },
        state.id,
      ),
    );
    const ended = (
      await (
        await POST(request({ action: "end", revision: 1 }, state.id))
      ).json()
    ).session;
    expect(ended.feedback.overallScore).toBe(40);
    expect(
      ended.feedback.assessments.map((a: { score: number }) => a.score),
    ).toEqual([0, 100, 100, 0, 0]);
    const restored = (await (await GET(request(undefined, state.id))).json())
      .session;
    expect(restored.feedback).toEqual(ended.feedback);
  });
});
