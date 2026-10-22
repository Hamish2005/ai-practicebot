import type { Scenario } from "./schema";
import type { EndReason, Feedback, Session } from "./types";

export const endLabels: Record<EndReason, string> = {
  complete_success: "All required objectives demonstrated",
  complete_turn_limit: "Maximum number of turns reached",
  complete_off_topic: "Too many consecutive off-topic turns",
  complete_safety: "Serious safety violation detected",
  complete_user: "You ended the session",
};
// Scores describe demonstrated skills, not the evaluator's confidence.
const categoryScores = { met: 100, partial: 50, not_met: 0 } as const;
export function createFeedback(
  scenario: Scenario,
  state: Session,
  reason: EndReason,
): Feedback {
  const assessments = scenario.objectives.map((o) => {
    const assessment = state.objectives.find((a) => a.objectiveId === o.id)!;
    return {
      ...assessment,
      title: o.title,
      required: o.required,
      score: categoryScores[assessment.status],
    };
  });
  const required = assessments.filter((a) => a.required);
  const overallScore = Math.round(
    required.reduce((sum, a) => sum + a.score, 0) / required.length,
  );
  const suggestions = scenario.objectives
    .filter(
      (o) => assessments.find((a) => a.objectiveId === o.id)?.status !== "met",
    )
    .slice(0, 3)
    .map((o) => o.description);
  if (reason === "complete_off_topic")
    suggestions.unshift(
      "Keep your replies focused on the customer’s billing concern.",
    );
  if (reason === "complete_safety")
    suggestions.unshift("Use respectful language and avoid threats or abuse.");
  for (const tip of [
    "Keep acknowledgments specific to the customer’s concern.",
    "Pair each proposed action with a clear expectation for follow-up.",
  ]) {
    if (suggestions.length < 2) suggestions.push(tip);
  }
  return {
    successful: reason === "complete_success",
    overallScore,
    assessedTurns: state.turns,
    reason,
    summary:
      state.turns === 0
        ? "No replies were submitted. Each category starts at 0 because no skills have been demonstrated yet."
        : reason === "complete_user"
          ? "You ended the session. Your scores reflect the replies you submitted, with no penalty for stopping early."
          : reason === "complete_success"
            ? scenario.completionMessage
            : scenario.incompleteSessionMessage,
    assessments,
    suggestions: suggestions.slice(0, 3),
  };
}
