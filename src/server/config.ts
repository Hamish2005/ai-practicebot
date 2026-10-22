import "server-only";
import { fakeProvider } from "../providers/fake";
import { createOpenAIProvider } from "../providers/openai";

export function getProvider() {
  const provider = process.env.AI_PROVIDER ?? "fake";
  if (provider === "fake") return fakeProvider;
  if (provider !== "openai")
    throw new Error("Set AI_PROVIDER to fake or openai in .env.local.");
  if (!process.env.OPENAI_API_KEY?.trim())
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to .env.local, or set AI_PROVIDER=fake.",
    );
  return createOpenAIProvider(
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL ?? "gpt-6-luna",
  );
}
