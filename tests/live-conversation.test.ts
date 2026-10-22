import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../src/server/realtime", () => ({
  liveGreeting: "Hello, how are you?",
  connectRealtime: vi.fn().mockResolvedValue("answer-sdp"),
}));
vi.mock("../src/server/config", () => ({ getProvider: vi.fn() }));
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/live/route";
import { getProvider } from "../src/server/config";
import { connectRealtime } from "../src/server/realtime";
import { sessions } from "../src/server/store";
import { startSession } from "../src/engine/session";
import { duplicateCharge } from "../src/scenarios/duplicate-charge";
import { fakeProvider, demoMessages } from "../src/providers/fake";
import { LiveTranscript } from "../src/components/live-transcript";

const actor = vi.fn();
const evaluate = vi.fn();
function request(
  body: unknown,
  origin = "http://localhost:3000",
  cookie = "live-test",
) {
  return new NextRequest("http://localhost:3000/api/live", {
    method: "POST",
    headers: {
      origin,
      cookie: `practice_session=${cookie}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
const user = (id = "u1", content = demoMessages[0]) => ({
  id,
  role: "user" as const,
  content,
});
let liveId: string;
async function command(
  events:
    | ReturnType<typeof user>[]
    | { id: string; role: "user" | "assistant"; content: string }[],
  action = "sync",
) {
  return POST(request({ action, sessionId: "live-test", liveId, events }));
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("AI_PROVIDER", "openai");
  vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
  evaluate.mockImplementation(fakeProvider.evaluator.evaluate);
  vi.mocked(getProvider).mockReturnValue({
    evaluator: { evaluate },
    actor: { generateReply: actor },
    parallelReplies: true,
  });
  sessions.clear();
  sessions.set("live-test", {
    state: startSession(duplicateCharge, "live-test", Date.now()),
    scenario: duplicateCharge,
    touchedAt: Date.now(),
    busy: false,
  });
  const result = await POST(
    request({
      action: "connect",
      sessionId: "live-test",
      revision: 0,
      sdp: "offer",
    }),
  );
  liveId = (await result.json()).liveId;
});
describe("live voice scoring", () => {
  it("starts new live conversations with the same greeting in voice and the saved transcript", () => {
    expect(sessions.get("live-test")!.state.transcript).toEqual([
      { role: "assistant", content: "Hello, how are you?" },
    ]);
    expect(
      vi.mocked(connectRealtime).mock.calls[0][2].transcript[0].content,
    ).toBe("Hello, how are you?");
  });
  it("reconnecting rotates ownership and rejects the old connection", async () => {
    await command([user()]);
    const result = await POST(
      request({
        action: "connect",
        sessionId: "live-test",
        revision: 1,
        sdp: "new-offer",
      }),
    );
    expect(result.status).toBe(200);
    expect((await result.json()).liveId).not.toBe(liveId);
    expect((await command([user()])).status).toBe(409);
    expect(sessions.get("live-test")!.state.turns).toBe(1);
  });
  it("scores without making an actor call, and retries do not double-score", async () => {
    expect((await command([user()])).status).toBe(200);
    expect((await command([user()])).status).toBe(200);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(actor).not.toHaveBeenCalled();
    expect(sessions.get("live-test")!.state.turns).toBe(1);
  });
  it("early ending drains the final reply and scores every category", async () => {
    const result = await command([user()], "end");
    const { session } = await result.json();
    expect(session.feedback.assessments).toHaveLength(
      duplicateCharge.objectives.length,
    );
    expect(session.feedback.assessedTurns).toBe(1);
    expect(session.endedAt).not.toBeNull();
    expect(
      session.feedback.assessments.some((a: { score: number }) => a.score > 0),
    ).toBe(true);
    await command([user()], "end");
    expect(evaluate).toHaveBeenCalledTimes(1);
  });
  it("ending before speaking still returns every category at zero", async () => {
    const { session } = await (await command([], "end")).json();
    expect(session.feedback.assessments).toHaveLength(
      duplicateCharge.objectives.length,
    );
    expect(session.feedback.overallScore).toBe(0);
  });
  it("rolls back the full batch on scoring failure, then allows a retry", async () => {
    evaluate.mockRejectedValueOnce(new Error("provider unavailable"));
    expect((await command([user()], "end")).status).toBe(502);
    expect(sessions.get("live-test")!.state.turns).toBe(0);
    expect(sessions.get("live-test")!.live!.events).toEqual([]);
    expect(sessions.get("live-test")!.busy).toBe(false);
    expect((await command([user()], "end")).status).toBe(200);
  });
  it("keeps assistant speech as context but never awards credit for it", async () => {
    await command(
      [{ id: "a", role: "assistant", content: demoMessages.join(" ") }],
      "end",
    );
    expect(sessions.get("live-test")!.state.feedback!.overallScore).toBe(0);
    expect(evaluate).not.toHaveBeenCalled();
  });
  it("rejects changed history, duplicate IDs, stale connection IDs and foreign origins", async () => {
    await command([user()]);
    expect((await command([user("u1", "changed")])).status).toBe(409);
    expect((await command([user(), user()])).status).toBe(409);
    expect(
      (
        await POST(
          request({
            action: "sync",
            sessionId: "live-test",
            liveId: "stale",
            events: [],
          }),
        )
      ).status,
    ).toBe(409);
    expect((await POST(request({}, "https://foreign.example"))).status).toBe(
      403,
    );
    expect(
      (
        await POST(
          request(
            { action: "sync", sessionId: "live-test", liveId, events: [] },
            undefined,
            "missing",
          ),
        )
      ).status,
    ).toBe(410);
  });
  it("serializes scoring and preserves automatic stop decisions until finalization", async () => {
    const all = demoMessages.map((content, i) => user(`u${i}`, content));
    const { shouldStop, session } = await (await command(all)).json();
    expect(shouldStop).toBe(true);
    expect(session.endedAt).toBeNull();
    const result = await (await command(all, "end")).json();
    expect(result.session.feedback.reason).toBe("complete_success");
    expect(connectRealtime).toHaveBeenCalledTimes(1);
  });
});
describe("ordered live transcript", () => {
  it("holds later transcriptions until earlier speech is complete", () => {
    const transcript = new LiveTranscript();
    transcript.add("one", "user");
    transcript.add("bot", "assistant");
    transcript.add("two", "user");
    transcript.complete("two", "user", "second reply");
    transcript.complete("bot", "assistant", "question");
    expect(transcript.prefix()).toEqual([]);
    transcript.complete("one", "user", "first reply");
    expect(transcript.prefix().map((i) => i.id)).toEqual(["one", "bot", "two"]);
    transcript.complete(
      "one",
      "user",
      "duplicate event cannot rewrite history",
    );
    expect(transcript.prefix()[0].content).toBe("first reply");
  });
});
