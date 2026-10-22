import type { EvaluationInput } from "../engine/types";
import type { EvaluationResult } from "../engine/schema";
import { injection, supportedClauses } from "./demo-rules";

/** Author preview only: exact rubric examples, never general semantic scoring. */
export function evaluateCustomDemo({
  scenario,
  transcript,
}: EvaluationInput): EvaluationResult {
  const words = transcript
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .filter((word) => !injection.test(word));
  const clauses = supportedClauses(words);
  return {
    objectives: scenario.objectives.map((objective) => {
      for (const status of ["met", "partial"] as const) {
        for (const example of objective.scoringRubric?.[status].examples ??
          []) {
          const phrase = example.trim().toLowerCase();
          const text = [
            ...clauses,
            ...words.filter((word) => word.trim().toLowerCase() === phrase),
          ].find((word) => word.toLowerCase().includes(phrase));
          if (text && phrase) {
            const at = text.toLowerCase().indexOf(phrase);
            return {
              objectiveId: objective.id,
              status,
              confidence: 0.99,
              evidence: text.slice(at, at + phrase.length),
              reasoning:
                "Matched an author-provided example in offline preview. This is not a semantic assessment.",
            };
          }
        }
      }
      return {
        objectiveId: objective.id,
        status: "not_met" as const,
        confidence: 0,
        evidence: null,
        reasoning:
          "No author-provided example matched in offline preview. Use OpenAI mode to assess other wording.",
      };
    }),
    offTopic: injection.test(transcript.at(-1)?.content ?? ""),
    offTopicConfidence: 0.99,
    safetyViolation: /I will hurt you|I will kill you/i.test(
      transcript.at(-1)?.content ?? "",
    ),
    safetyReason: /I will hurt you|I will kill you/i.test(
      transcript.at(-1)?.content ?? "",
    )
      ? "A direct threat was detected."
      : null,
  };
}
