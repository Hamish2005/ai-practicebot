import { it, expect, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
vi.mock("server-only", () => ({}));
import { voiceProvider } from "../src/server/voice";
import { createOpenAIProvider } from "../src/providers/openai";
import { startSession, submitTurn } from "../src/engine/session";
import { duplicateCharge } from "../src/scenarios/duplicate-charge";

it.skipIf(process.env.RUN_LIVE_VOICE !== "1")(
  "live synthetic speech through transcription, scoring and spoken reply",
  async () => {
    try {
      const input =
        "I understand how frustrating this is. I can request a refund for the duplicate payment.";
      // Synthetic input tests the service chain without accessing the user's microphone.
      const source = await voiceProvider.speak(input);
      const start = performance.now();
      const transcript = await voiceProvider.transcribe(
        new File([source], "sample.mp3", { type: "audio/mpeg" }),
      );
      const transcribed = performance.now();
      expect(transcript.toLowerCase()).toContain("refund");
      const state = await submitTurn(
        duplicateCharge,
        startSession(duplicateCharge, "voice-smoke", Date.now()),
        transcript,
        createOpenAIProvider(
          process.env.OPENAI_API_KEY!,
          process.env.OPENAI_MODEL ?? "gpt-6-luna",
        ),
      );
      const replied = performance.now();
      expect(state.endedAt).toBeNull();
      const reply = state.transcript.at(-1)!;
      expect(reply.role).toBe("assistant");
      const audio = await voiceProvider.speak(reply.content);
      const ended = performance.now();
      expect(audio.byteLength).toBeGreaterThan(100);
      await mkdir("test-results", { recursive: true });
      await writeFile("test-results/voice-reply.mp3", Buffer.from(audio));
      const report = {
        startedAt: new Date().toISOString(),
        model: process.env.OPENAI_MODEL ?? "gpt-6-luna",
        transcriptionModel:
          process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
        speechModel: process.env.OPENAI_SPEECH_MODEL || "gpt-4o-mini-tts",
        input,
        transcript,
        reply: reply.content,
        transcriptionMs: Math.round(transcribed - start),
        conversationMs: Math.round(replied - transcribed),
        speechMs: Math.round(ended - replied),
        totalMs: Math.round(ended - start),
        audioBytes: audio.byteLength,
        note: "One synthetic audio smoke test. Excludes recording, human review time, browser upload, playback decoding and user network latency. Not microphone-to-first-sound latency.",
      };
      await writeFile(
        "test-results/live-voice.json",
        JSON.stringify(report, null, 2),
      );
      console.log(JSON.stringify(report));
    } catch (error) {
      const e = error as { status?: number; name?: string };
      throw new Error(
        `Voice smoke test failed (${e.status ?? "no HTTP status"}, ${e.name ?? "unknown"}). Check provider access and configuration.`,
      );
    }
  },
  180_000,
);
