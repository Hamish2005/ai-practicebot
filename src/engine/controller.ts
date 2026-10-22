import type { EvaluationResult, Scenario } from "./schema";
import type { Decision, Session } from "./types";

/** State already includes this turn's validated objective updates and off-topic count. */
export function decide(
  scenario: Scenario,
  state: Session,
  evaluation: EvaluationResult,
): Decision {
  if (evaluation.safetyViolation) return "complete_safety";
  if (state.consecutiveOffTopic >= scenario.maximumConsecutiveOffTopicTurns)
    return "complete_off_topic";
  if (
    scenario.objectives
      .filter((o) => o.required)
      .every((o) =>
        state.objectives.some(
          (a) => a.objectiveId === o.id && a.status === "met",
        ),
      )
  )
    return "complete_success";
  if (state.turns >= scenario.maximumTurns) return "complete_turn_limit";
  if (
    !state.warningIssued &&
    state.consecutiveOffTopic >= scenario.offTopicWarningAt
  )
    return "warn_off_topic";
  return "continue";
}
