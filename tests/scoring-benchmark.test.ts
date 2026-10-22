import { describe, expect, it } from "vitest";
import { conversations } from "../benchmarks/duplicate-charge";
import { runBenchmark } from "../benchmarks/run";
import { writeBenchmarkReport } from "../benchmarks/report";

describe("reviewer-labeled conversation benchmark", () => {
  it("compares 15 conversations and 75 category scores with fixed reviewer targets", async () => {
    const results = await runBenchmark();
    if (process.env.SCORE_BENCHMARK_REPORT === "1")
      await writeBenchmarkReport(results);
    for (const [i, result] of results.entries()) {
      const target = conversations[i];
      expect
        .soft(result.actual, `${target.id}: ${target.title}`)
        .toEqual(target.expected);
      expect
        .soft(result.endReason, `${target.id}: ending reason`)
        .toBe(target.endReason);
      expect
        .soft(result.turns, `${target.id}: all intended turns processed`)
        .toBe(target.messages.length);
      for (const assessment of result.feedback.assessments.filter(
        (a) => a.score > 0,
      )) {
        expect(
          assessment.evidence,
          `${target.id}: evidence for ${assessment.objectiveId}`,
        ).toBeTruthy();
        expect(
          result.transcript.some(
            (m) =>
              m.role === "user" && m.content.includes(assessment.evidence!),
          ),
        ).toBe(true);
      }
    }
  });
});
