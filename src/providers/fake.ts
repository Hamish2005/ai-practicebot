import type { EvaluationInput, Provider } from "../engine/types";
import type { EvaluationResult } from "../engine/schema";
import { demoObservation, injection, supportedClauses } from "./demo-rules";
import { evaluateCustomDemo } from "./custom-demo";

/** Offline examples plus conservative rules for common conversational wording. */
export const demoMessages = [
  "I can see you were charged twice for the same order. I understand how frustrating this is, and I am sorry.",
  "I will check your order and request a refund for the duplicate payment.",
  "You will receive an email confirmation today, and the refund should arrive in 3–5 business days. Does that refund plan work for you?",
];
function evaluate({ scenario, transcript }: EvaluationInput): EvaluationResult {
  if (scenario.id !== "duplicate-charge")
    return evaluateCustomDemo({ scenario, transcript });
  const words = transcript
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  const usable = supportedClauses(words);
  const latest = words.at(-1) ?? "";
  return {
    objectives: scenario.objectives.map((o) => {
      const exactEvidence =
        o.evaluationType === "exact_phrase"
          ? (usable.find((w) =>
              o.exactPhrases!.some((p) =>
                w.toLowerCase().includes(p.toLowerCase()),
              ),
            ) ?? null)
          : null;
      const observation =
        o.evaluationType === "exact_phrase"
          ? {
              status: exactEvidence ? ("met" as const) : ("not_met" as const),
              evidence: exactEvidence,
            }
          : demoObservation(o.id, usable);
      const { status, evidence } = observation;
      return {
        objectiveId: o.id,
        status,
        confidence: status === "met" ? 0.99 : status === "partial" ? 0.9 : 0,
        evidence,
        reasoning:
          `${status === "not_met" ? "No supported demonstration was found by the offline rules." : status === "partial" ? "A partial attempt was identified by the offline rules." : "A supported demonstration was identified by the offline rules."} ${o.scoringRubric?.[status].description ?? ""}`.trim(),
      };
    }),
    offTopic:
      injection.test(latest) || /weather|football|pizza|vacation/i.test(latest),
    offTopicConfidence: 0.99,
    safetyViolation: /I will hurt you|I will kill you/i.test(latest),
    safetyReason: /I will hurt you|I will kill you/i.test(latest)
      ? "A direct threat was detected."
      : null,
  };
}
export const fakeProvider: Provider = {
  evaluator: { evaluate: async (input) => evaluate(input) },
  actor: {
    generateReply: async ({ scenario, transcript, objectives }) => {
      if (scenario.id !== "duplicate-charge") {
        const replies = [
          "Thank you for explaining. What would you suggest we do next?",
          "Could you tell me a little more about how that would work?",
          "I am listening. Is there anything else you would like to explain?",
        ];
        return replies[
          (transcript.filter((m) => m.role === "user").length - 1) %
            replies.length
        ];
      }
      const met = (id: string) =>
        objectives.some((o) => o.objectiveId === id && o.status === "met");
      const used = new Set(
        transcript.filter((m) => m.role === "assistant").map((m) => m.content),
      );
      const candidates: string[] = [];
      if (
        injection.test(transcript.at(-1)?.content ?? "") ||
        /weather|football|pizza|vacation/i.test(
          transcript.at(-1)?.content ?? "",
        )
      ) {
        candidates.push(
          "I just need help with the extra charge on my order. Can we focus on that?",
          "The duplicate payment is still my concern. I'd like to get back to sorting that out.",
        );
      } else if (met("resolution")) {
        if (!met("next_steps"))
          candidates.push(
            "Thank you for offering a refund. When should I expect the money back?",
            "I appreciate that. How will I receive confirmation once the refund is arranged?",
          );
        if (!met("acknowledge"))
          candidates.push(
            "Just to check, your refund plan covers the extra payment for the same order, right?",
          );
        if (!met("empathy"))
          candidates.push(
            "This has been stressful because I needed that money for other things.",
          );
        candidates.push(
          "That gives me a clearer picture. I'd like to agree on the next step before you go ahead.",
        );
      } else {
        if (met("empathy"))
          candidates.push(
            "Thank you for understanding. What can you do about the extra payment?",
          );
        candidates.push(
          "There are two payments for one order on my statement. What can you do about the extra payment?",
          "I need a concrete way to get the extra payment back. What can you offer?",
        );
      }
      return (
        candidates.find((reply) => !used.has(reply)) ??
        "I'm still here. Please go ahead with the details of how you can help with the extra payment."
      );
    },
  },
};
