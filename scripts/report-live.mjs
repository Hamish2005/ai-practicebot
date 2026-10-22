import { readFileSync, writeFileSync } from "node:fs";

const report = JSON.parse(
  readFileSync("test-results/live-openai.json", "utf8"),
);
const completed = report.results.filter((r) => Array.isArray(r.actual));
const comparisons = completed.length * report.categoryIds.length;
const differences = completed.reduce((n, r) => n + r.mismatches.length, 0);
const timings = completed
  .flatMap((r) => r.turnDurationsMs)
  .sort((a, b) => a - b);
const medianOfSorted = (values) =>
  values.length % 2
    ? values[Math.floor(values.length / 2)]
    : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
const endingMatches = completed.filter(
  (r) => r.actualEndReason === r.expectedEndReason,
).length;
const lines = [
  `# Live ${report.model} scoring review`,
  "",
  `Run started: ${report.startedAt}. Model: ${report.model}.`,
  `Scoring reasoning: ${report.scoringReasoning ?? "low"}.`,
  `Reply generation: ${report.parallelReplies ? "parallel with evaluation; controller gates publication" : "sequential after evaluation"}.`,
  "",
  report.note,
  "",
  `Completed ${completed.length}/15 sample conversations. ${comparisons - differences}/${comparisons} category scores matched the provisional targets. ${endingMatches}/${completed.length} ending reasons matched.`,
  "",
  timings.length
    ? `Measured ${timings.length} learner turns: median ${(medianOfSorted(timings) / 1000).toFixed(1)}s, maximum ${(timings.at(-1) / 1000).toFixed(1)}s. Times include evaluation and, when continuing, the bot reply. API usage charges were not measured by this runner.`
    : "No live turn timings available.",
  "",
  `Score order: ${report.categoryIds.join(", ")}.`,
  "",
  "| Case | Expected | Actual | Ending matches |",
  "| --- | --- | --- | --- |",
  ...completed.map(
    (r) =>
      `| ${r.id}: ${r.title} | ${r.expected.join(" / ")} | ${r.actual.join(" / ")} | ${r.actualEndReason === r.expectedEndReason ? "Yes" : "No"} |`,
  ),
];
const calls = completed.flatMap((r) => r.callTimings ?? []);
if (calls.length) {
  lines.push(
    "",
    "## Individual call timings",
    "",
    "Elapsed times include SDK/network overhead and any retries. Calls overlap, so these durations must not be added. Cancelled drafts are excluded from completed-call medians.",
    "",
    "| Call | Completed | Median | Maximum | Cancelled |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const operation of ["scoring", "reply"]) {
    const subset = calls.filter((c) => c.operation === operation);
    const durations = subset
      .filter((c) => c.outcome === "completed")
      .map((c) => c.elapsedMs)
      .sort((a, b) => a - b);
    const median = durations.length
      ? (medianOfSorted(durations) / 1000).toFixed(2) + "s"
      : "n/a";
    const max = durations.length
      ? (durations.at(-1) / 1000).toFixed(2) + "s"
      : "n/a";
    lines.push(
      `| ${operation} | ${durations.length} | ${median} | ${max} | ${subset.filter((c) => c.outcome === "cancelled").length} |`,
    );
  }
  lines.push(
    "",
    "### Each learner turn",
    "",
    "| Case / turn | Visible wait | Scoring | Reply | Reply outcome |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const r of completed) {
    for (const [index, duration] of r.turnDurationsMs.entries()) {
      const scoring = r.callTimings?.find(
        (c) => c.turn === index + 1 && c.operation === "scoring",
      );
      const reply = r.callTimings?.find(
        (c) => c.turn === index + 1 && c.operation === "reply",
      );
      lines.push(
        `| ${r.id} / ${index + 1} | ${(duration / 1000).toFixed(2)}s | ${scoring ? (scoring.elapsedMs / 1000).toFixed(2) + "s" : "n/a"} | ${reply ? (reply.elapsedMs / 1000).toFixed(2) + "s" : "n/a"} | ${reply?.outcome ?? "n/a"} |`,
      );
    }
  }
}
lines.push("", "## Differences requiring review", "");
for (const result of completed) {
  for (const id of result.mismatches) {
    const assessment = result.feedback.assessments.find(
      (a) => a.objectiveId === id,
    );
    const expected = result.expected[report.categoryIds.indexOf(id)];
    lines.push(
      `### Case ${result.id}: ${assessment.title}`,
      "",
      `Expected ${expected}; received ${assessment.score}.`,
      "",
      `Reviewer target: ${result.judgment}`,
      "",
      `Model reasoning: ${assessment.reasoning}`,
      "",
      `Evidence: ${JSON.stringify(assessment.evidence)}`,
      "",
    );
  }
}
for (const result of report.results.filter((r) => r.failed)) {
  lines.push(
    `Case ${result.id} failed: ${result.status ?? "no HTTP status"}; ${result.code ?? result.errorType}. Later cases were not run.`,
    "",
  );
}
lines.push(
  "## Scope and next checks",
  "",
  "These are live requests through the production provider adapter and session engine, not browser tests. Learner replies are fixed synthetic scripts; bot replies are generated live. Early endings use the same finishSession function as the app. The test does not establish repeated-run consistency, quality across custom scenarios, or performance under concurrent load. Review mismatches against the actual rubric before changing prompts or target scores, then repeat the affected cases.",
  "",
);
writeFileSync("docs/live-scoring-review.md", lines.join("\n"));
console.log(
  `Live scoring review: ${comparisons - differences}/${comparisons} category targets matched across ${completed.length} completed conversations. See docs/live-scoring-review.md.`,
);
