import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
if (!process.env.OPENAI_API_KEY?.trim()) {
  console.error(
    "Add OPENAI_API_KEY to .env.local before running the voice smoke test.",
  );
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "tests/live-voice.test.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, RUN_LIVE_VOICE: "1" },
  },
);
process.exit(result.status ?? 1);
