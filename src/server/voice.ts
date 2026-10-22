import "server-only";
import OpenAI from "openai";

function client() {
  if (!process.env.OPENAI_API_KEY?.trim())
    throw new Error("Voice is not configured.");
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30_000,
    maxRetries: 0,
  });
}

export const voiceProvider = {
  async transcribe(file: File, signal?: AbortSignal) {
    const result = await client().audio.transcriptions.create(
      {
        model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
        language: "en",
        file,
      },
      { signal },
    );
    return result.text;
  },
  async speak(text: string, signal?: AbortSignal) {
    const result = await client().audio.speech.create(
      {
        model: process.env.OPENAI_SPEECH_MODEL || "gpt-4o-mini-tts",
        voice: "coral",
        input: text,
        instructions:
          "Speak naturally and clearly, at a conversational pace. Read the supplied dialogue without adding words.",
        response_format: "mp3",
      },
      { signal },
    );
    return result.arrayBuffer();
  },
};
