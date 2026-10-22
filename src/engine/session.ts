import {
  evaluationSchema,
  messageSchema,
  type Assessment,
  type Scenario,
} from "./schema";
import { decide } from "./controller";
import { createFeedback } from "./feedback";
import type { EndReason, Provider, Session } from "./types";

export function startSession(
  scenario: Scenario,
  id: string,
  now: number,
): Session {
  return {
    id,
    scenarioId: scenario.id,
    startedAt: now,
    endedAt: null,
    turns: 0,
    revision: 0,
    transcript: [{ role: "assistant", content: scenario.openingMessage }],
    objectives: scenario.objectives.map((o) => ({
      objectiveId: o.id,
      status: "not_met",
      confidence: 0,
      evidence: null,
      reasoning: "Not yet demonstrated.",
    })),
    consecutiveOffTopic: 0,
    warningIssued: false,
    decision: "continue",
    feedback: null,
  };
}
export function finishSession(
  scenario: Scenario,
  state: Session,
  reason: EndReason,
  now: number,
): Session {
  if (state.endedAt !== null) return state;
  return {
    ...state,
    endedAt: now,
    decision: reason,
    feedback: createFeedback(scenario, state, reason),
  };
}

/** Transactional: never mutates input; unused draft failures cannot block completion. */
export async function submitTurn(
  scenario: Scenario,
  current: Session,
  message: string,
  provider: Provider,
  now: () => number = Date.now,
  live = false,
): Promise<Session> {
  if (current.endedAt !== null)
    throw new Error("This session has ended. Restart to practice again.");
  const content = messageSchema.parse(message);
  const transcript = [
    ...current.transcript,
    { role: "user" as const, content },
  ];
  const cancellation = new AbortController();
  const speculativeReply =
    !live && provider.parallelReplies
      ? Promise.resolve()
          .then(() =>
            provider.actor.generateReply({
              scenario,
              transcript,
              objectives: current.objectives,
              signal: cancellation.signal,
            }),
          )
          .then(
            (reply) => ({ ok: true as const, reply }),
            (error) => ({ ok: false as const, error }),
          )
      : undefined;
  try {
    const evaluation = evaluationSchema.parse(
      await provider.evaluator.evaluate({ scenario, transcript }),
    );
    const ids = evaluation.objectives.map((o) => o.objectiveId);
    if (
      ids.length !== scenario.objectives.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !scenario.objectives.some((o) => o.id === id))
    ) {
      throw new Error(
        "The evaluator returned an invalid objective set. Please retry.",
      );
    }
    const userWords = transcript
      .filter((m) => m.role === "user")
      .map((m) => m.content);
    const objectives: Assessment[] = scenario.objectives.map((objective) => {
      const previous = current.objectives.find(
        (a) => a.objectiveId === objective.id,
      )!;
      if (previous.status === "met" && !scenario.allowObjectiveRegression)
        return previous;
      const observed = evaluation.objectives.find(
        (a) => a.objectiveId === objective.id,
      )!;
      const evidence = observed.evidence?.trim();
      const grounded = Boolean(
        evidence && userWords.some((words) => words.includes(evidence)),
      );
      const exact =
        objective.evaluationType !== "exact_phrase" ||
        objective.exactPhrases!.some((phrase) =>
          evidence?.toLocaleLowerCase().includes(phrase.toLocaleLowerCase()),
        );
      const met =
        observed.status === "met" &&
        observed.confidence >= objective.minimumConfidence &&
        grounded &&
        exact;
      const status = met
        ? "met"
        : observed.status !== "not_met" && grounded
          ? "partial"
          : "not_met";
      return {
        ...observed,
        status,
        evidence: grounded ? evidence! : null,
        reasoning:
          !grounded && observed.status !== "not_met"
            ? "No verifiable quote from the learner supports this assessment."
            : observed.reasoning,
      };
    });
    let state: Session = {
      ...current,
      transcript,
      objectives,
      turns: current.turns + 1,
      revision: current.revision + 1,
      consecutiveOffTopic:
        evaluation.offTopic &&
        evaluation.offTopicConfidence >= scenario.offTopicConfidenceThreshold
          ? current.consecutiveOffTopic + 1
          : 0,
    };
    const decision = decide(scenario, state, evaluation);
    state = {
      ...state,
      decision,
      warningIssued: state.warningIssued || decision === "warn_off_topic",
    };
    // Live audio has already answered. Its caller drains pending transcripts
    // before finalizing, so every spoken learner turn is assessed.
    if (live) return state;
    if (decision.startsWith("complete_"))
      return finishSession(scenario, state, decision as EndReason, now());
    const result = speculativeReply ? await speculativeReply : undefined;
    if (result && !result.ok) throw result.error;
    const reply = (
      result?.ok
        ? result.reply
        : await provider.actor.generateReply({
            scenario,
            transcript,
            objectives,
          })
    ).trim();
    if (!reply)
      throw new Error(
        "The character returned an empty response. Please retry.",
      );
    return {
      ...state,
      transcript: [...transcript, { role: "assistant", content: reply }],
    };
  } finally {
    // Termination or evaluator failure never waits for or publishes a draft reply.
    // The rejection handler above also consumes cancellation/late actor errors.
    cancellation.abort();
  }
}
