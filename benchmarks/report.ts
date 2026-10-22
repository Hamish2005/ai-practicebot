import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { conversations, categoryIds } from "./duplicate-charge";
import { duplicateCharge } from "../src/scenarios/duplicate-charge";
import type { runBenchmark } from "./run";

type Result = Awaited<ReturnType<typeof runBenchmark>>[number];
type Baseline = Pick<Result, "id" | "actual" | "overall" | "endReason">;
const formatScores = (scores: number[]) => scores.join(" / ");

export async function writeBenchmarkReport(results: Result[]) {
  const baseline: Baseline[] = JSON.parse(
    readFileSync("benchmarks/baseline.json", "utf8"),
  );
  const categoryMatches = (rows: Baseline[]) =>
    rows.reduce(
      (total, row, i) =>
        total +
        row.actual.filter((score, j) => score === conversations[i].expected[j])
          .length,
      0,
    );
  const conversationMatches = (rows: Baseline[]) =>
    rows.filter(
      (row, i) =>
        row.actual.every(
          (score, j) => score === conversations[i].expected[j],
        ) && row.endReason === conversations[i].endReason,
    ).length;
  const lines = [
    "# Duplicate-charge scoring review",
    "",
    "**Scope:** 15 fixed conversations, 75 final category judgments. Targets were written by the coding assistant before adjusting the offline rules. They are provisional reviewer judgments for the product owner to approve, not independent human labels or the owner’s own ratings.",
    "",
    "**Provider tested:** deterministic offline provider through the real session engine and feedback generator. No API calls were made. The scenario now supplies the same three-level criteria to the existing OpenAI evaluator, but live-model agreement has not been tested.",
    "",
    "## Scoring policy",
    "",
    "- 100 = the behavior is demonstrated; 50 = a meaningful but incomplete attempt; 0 = not demonstrated.",
    "- Confidence measures certainty, not proficiency. A confidently identified partial attempt still earns 50.",
    "- Credit requires a quote from a submitted learner message. Assistant replies, keywords, quoted scripts, instructions, and negations do not earn credit.",
    "- Required categories have equal weight. Previously met categories retain credit. Ending early adds no penalty; unaddressed categories remain 0.",
    "- Judge an agreement question against the plan available when it was asked. A later proposal does not retroactively supply its missing context.",
    "",
    "## Examples for each category",
    "",
  ];
  for (const objective of duplicateCharge.objectives) {
    lines.push(
      `### ${objective.title}`,
      "",
      "| Score | Criterion | Examples |",
      "| --- | --- | --- |",
    );
    for (const [status, score] of [
      ["not_met", 0],
      ["partial", 50],
      ["met", 100],
    ] as const) {
      const rubric = objective.scoringRubric![status];
      lines.push(
        `| ${score} | ${rubric.description} | ${rubric.examples.map((example) => `“${example}”`).join("<br>")} |`,
      );
    }
    lines.push("");
  }
  lines.push(
    "## Before and after",
    "",
    "| Measure | Before calibration | After calibration |",
    "| --- | --- | --- |",
    `| Exact category agreement | ${categoryMatches(baseline)} / 75 | ${categoryMatches(results)} / 75 |`,
    `| Whole conversation agreement (scores and ending) | ${conversationMatches(baseline)} / 15 | ${conversationMatches(results)} / 15 |`,
    "",
    "This is agreement on the same examples used to calibrate the offline rules. It is a regression benchmark, not an estimate of accuracy on new conversations. There is no independent or held-out evaluation in this milestone.",
    "",
    "Category order in every score vector: acknowledgment / empathy / resolution / next steps / confirmation.",
    "",
    "| Conversation | Reviewer target | Before | After |",
    "| --- | --- | --- | --- |",
  );
  for (const [i, sample] of conversations.entries())
    lines.push(
      `| ${sample.id}. ${sample.title} | ${formatScores(sample.expected)} | ${formatScores(baseline[i].actual)} | ${formatScores(results[i].actual)} |`,
    );
  lines.push(
    "",
    "## Disagreements and adjustments",
    "",
    "- **01:** “Does that plan work for you?” was missed. Broadened the contextual agreement rule beyond the original sample phrase.",
    "- **04–08:** Partial attempts were mostly treated as absent. Added partial criteria and matching for generic billing acknowledgment, generic apologies, vague promises, preparatory verification, vague follow-up, and ambiguous agreement checks.",
    "- **09:** A later refund offer incorrectly upgraded an earlier agreement question to full credit. The offline evaluator now tracks plan context in chronological order.",
    "- **02, 03, 10–15:** Retained the already-correct behavior for cumulative skills, early stopping, negative/quoted/meta language, unsupported claims, and off-topic endings.",
    "- Added criteria and examples to the validated scenario data, which the existing OpenAI evaluator already receives. Offline feedback now cites the category-specific criterion rather than one generic explanation.",
    "- Checking every published rubric example also caught two inconsistencies: explicit acknowledgment of stress was missed, while an unspecified “I’ll update you” was over-credited. Stress is now recognized and an update requires a concrete expectation for full credit.",
    "",
    "## Review each conversation",
    "",
  );
  for (const [i, sample] of conversations.entries()) {
    const result = results[i];
    lines.push(`### ${sample.id}. ${sample.title}`, "");
    sample.messages.forEach((message, turn) =>
      lines.push(`**Learner turn ${turn + 1}:** ${message}`, ""),
    );
    lines.push(
      `**Reviewer judgment:** ${sample.judgment}`,
      "",
      `**Scores:** target ${formatScores(sample.expected)}; actual ${formatScores(result.actual)}. Overall: ${result.overall}/100.`,
      "",
      `**Ending:** expected ${sample.endReason}; actual ${result.endReason}.`,
      "",
      "**Evidence used by the app:**",
      "",
    );
    for (const id of categoryIds) {
      const assessment = result.feedback.assessments.find(
        (a) => a.objectiveId === id,
      )!;
      lines.push(
        `- ${assessment.title}: **${assessment.score}** — ${assessment.evidence ? `“${assessment.evidence}”` : "No supporting evidence."}`,
      );
    }
    lines.push("");
  }
  lines.push(
    "## Reproduce and review",
    "",
    "- `npm run benchmark` checks the frozen reviewer targets without writing files.",
    "- `npm run benchmark:report` runs the same checks and refreshes this report.",
    "- Labels and rationale: `benchmarks/duplicate-charge.ts`. The captured pre-change results are in `benchmarks/baseline.json`.",
    "- Rubric source: `src/scenarios/duplicate-charge-rubric.ts`. No benchmark fixture is imported by production code.",
    "- To disagree with a rating, identify its case number and category. Review the criterion first; record a reason before changing a target. Do not change labels merely to make a test pass.",
    "",
    "## Remaining limits",
    "",
    "Offline pattern rules still have limited vocabulary and cannot reliably interpret every paraphrase, sarcasm, contradiction, quotation style, or conditional statement. The sample does not prove general safety or evaluation accuracy. The original monotonic policy preserves already-met objectives even if a later reply contradicts them; that policy has not been changed here. A future live-model benchmark should use new independently reviewed conversations, including contradictions and unseen wording, and report disagreements without silently revising expected labels.",
    "",
  );
  writeFileSync(
    "docs/scoring-review.md",
    await format(lines.join("\n"), { parser: "markdown" }),
  );
}
