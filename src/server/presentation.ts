import type { Session } from "../engine/types";
import { createFeedback } from "../engine/feedback";
import { duplicateCharge } from "../scenarios/duplicate-charge";
import type { Scenario } from "../engine/schema";
import { summarizeScenario } from "../scenarios/authoring";

export function presentSession(
  state: Session,
  scenario: Scenario = duplicateCharge,
) {
  return {
    id: state.id,
    liveRecovery: false,
    scenario: summarizeScenario(scenario),
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    transcript: state.transcript,
    turns: state.turns,
    revision: state.revision,
    // Refresh reviews retained in memory across a development scoring update.
    feedback:
      state.feedback && state.feedback.overallScore === undefined
        ? createFeedback(scenario, state, state.feedback.reason)
        : state.feedback,
    warning: state.decision === "warn_off_topic",
    offTopicTurnsRemaining: Math.max(
      0,
      scenario.maximumConsecutiveOffTopicTurns - state.consecutiveOffTopic,
    ),
    trainer:
      process.env.NODE_ENV === "development"
        ? {
            objectives: state.objectives,
            titles: Object.fromEntries(
              scenario.objectives.map((o) => [o.id, o.title]),
            ),
            consecutiveOffTopic: state.consecutiveOffTopic,
            decision: state.decision,
          }
        : null,
  };
}
export type PublicSession = ReturnType<typeof presentSession>;
