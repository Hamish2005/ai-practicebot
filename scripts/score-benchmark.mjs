import { execFileSync } from "node:child_process";

execFileSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "tests/scoring-benchmark.test.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, SCORE_BENCHMARK_REPORT: "1" },
  },
);
