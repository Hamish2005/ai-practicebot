import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../src/server/voice", () => ({
  voiceProvider: { transcribe: vi.fn(), speak: vi.fn() },
}));
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/voice/route";
import { voiceProvider } from "../src/server/voice";
import { sessions } from "../src/server/store";
import { startSession, finishSession } from "../src/engine/session";
import { duplicateCharge } from "../src/scenarios/duplicate-charge";

function request(
  body: unknown,
  cookie = "voice-test",
  origin = "http://localhost:3000",
) {
  return new NextRequest("http://localhost:3000/api/voice", {
    method: "POST",
    headers: {
      origin,
      cookie: `practice_session=${cookie}`,
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}
function recording(type = "audio/webm", text = "fake recording") {
  const form = new FormData();
  form.set("audio", new File([text], "reply.webm", { type }));
  form.set("sessionId", "voice-test");
  form.set("revision", "0");
  return form;
}
const speech = () => ({
  sessionId: "voice-test",
  revision: 0,
  messageIndex: 0,
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AI_PROVIDER", "openai");
  vi.stubEnv("OPENAI_API_KEY", "test-only-placeholder");
  sessions.clear();
  sessions.set("voice-test", {
    state: startSession(duplicateCharge, "voice-test", Date.now()),
    touchedAt: Date.now(),
    busy: false,
  });
  vi.mocked(voiceProvider.transcribe).mockResolvedValue(
    "I understand this is frustrating.",
  );
  vi.mocked(voiceProvider.speak).mockResolvedValue(
    new Uint8Array([1, 2, 3]).buffer,
  );
});
describe("voice session boundaries", () => {
  it("transcribes to a draft without committing a turn or changing scores", async () => {
    const original = structuredClone(sessions.get("voice-test")!.state);
    const result = await POST(request(recording()));
    expect(result.status).toBe(200);
    expect((await result.json()).text).toBe(
      "I understand this is frustrating.",
    );
    expect(sessions.get("voice-test")!.state).toEqual(original);
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
  it("speaks only the latest server-owned bot reply", async () => {
    const result = await POST(request(speech()));
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("audio/mpeg");
    expect(voiceProvider.speak).toHaveBeenCalledWith(
      duplicateCharge.openingMessage,
      expect.any(AbortSignal),
    );
    expect(
      (await POST(request({ ...speech(), text: "Read my arbitrary text" })))
        .status,
    ).toBe(400);
    expect(voiceProvider.speak).toHaveBeenCalledTimes(1);
  });
  it("rejects foreign origins, missing sessions and mismatched identity/revisions", async () => {
    expect(
      (await POST(request(speech(), "voice-test", "https://other.example")))
        .status,
    ).toBe(403);
    expect((await POST(request(speech(), "unknown"))).status).toBe(410);
    expect(
      (await POST(request({ ...speech(), sessionId: "another-session" })))
        .status,
    ).toBe(409);
    expect((await POST(request({ ...speech(), revision: 2 }))).status).toBe(
      409,
    );
    expect(voiceProvider.speak).not.toHaveBeenCalled();
  });
  it("rejects ended/busy sessions and offline mode", async () => {
    const entry = sessions.get("voice-test")!;
    entry.busy = true;
    expect((await POST(request(recording()))).status).toBe(409);
    entry.busy = false;
    vi.stubEnv("AI_PROVIDER", "fake");
    expect((await POST(request(recording()))).status).toBe(503);
    vi.stubEnv("AI_PROVIDER", "openai");
    entry.state = finishSession(
      duplicateCharge,
      entry.state,
      "complete_user",
      Date.now(),
    );
    expect((await POST(request(recording()))).status).toBe(410);
    expect(voiceProvider.transcribe).not.toHaveBeenCalled();
  });
  it("rejects unsupported, empty and oversized recordings", async () => {
    expect((await POST(request(recording("text/plain")))).status).toBe(415);
    expect((await POST(request(recording("audio/webm", "")))).status).toBe(413);
    expect(
      (
        await POST(
          request(recording("audio/webm", "a".repeat(5 * 1024 * 1024 + 1))),
        )
      ).status,
    ).toBe(413);
    expect(voiceProvider.transcribe).not.toHaveBeenCalled();
  });
  it("rejects empty or overlong transcripts without truncating them", async () => {
    vi.mocked(voiceProvider.transcribe)
      .mockResolvedValueOnce("   ")
      .mockResolvedValueOnce("a".repeat(4001));
    expect((await POST(request(recording()))).status).toBe(422);
    expect((await POST(request(recording()))).status).toBe(422);
  });
  it("discards results if another tab changes the session", async () => {
    vi.mocked(voiceProvider.transcribe).mockImplementation(async () => {
      sessions.get("voice-test")!.state.revision++;
      return "Late transcript";
    });
    expect((await POST(request(recording()))).status).toBe(409);
    expect(sessions.get("voice-test")!.state.turns).toBe(0);
  });
  it("rejects user-message playback and stops audio after session completion", async () => {
    const entry = sessions.get("voice-test")!;
    entry.state.transcript.push({ role: "user", content: "hello" });
    expect((await POST(request({ ...speech(), messageIndex: 1 }))).status).toBe(
      400,
    );
    entry.state.transcript.pop();
    vi.mocked(voiceProvider.speak).mockImplementation(async () => {
      entry.state = finishSession(
        duplicateCharge,
        entry.state,
        "complete_user",
        Date.now(),
      );
      return new ArrayBuffer(1);
    });
    expect((await POST(request(speech()))).status).toBe(409);
  });
  it("serializes voice calls and releases the lock after failure", async () => {
    const started = Promise.withResolvers<void>();
    const gate = Promise.withResolvers<string>();
    vi.mocked(voiceProvider.transcribe).mockImplementationOnce(() => {
      started.resolve();
      return gate.promise;
    });
    const first = POST(request(recording()));
    await started.promise;
    expect((await POST(request(recording()))).status).toBe(409);
    gate.reject(new Error("Provider unavailable"));
    expect((await first).status).toBe(502);
    expect((await POST(request(recording()))).status).toBe(200);
  });
});
