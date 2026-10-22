import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
if (process.argv.length > 2) {
  console.error(
    "Run npm run test:live without options. Experimental scoring settings have been removed.",
  );
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY?.trim()) {
  console.error("Add OPENAI_API_KEY to .env.local before running live tests.");
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "tests/live-openai.test.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      RUN_LIVE_OPENAI: "1",
    },
  },
);
if (result.status === 0) {
  const summary = spawnSync(process.execPath, ["scripts/report-live.mjs"], {
    stdio: "inherit",
  });
  if (summary.status !== 0) process.exit(summary.status ?? 1);
}
process.exit(result.status ?? 1);
