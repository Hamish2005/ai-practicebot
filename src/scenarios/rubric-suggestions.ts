import { z } from "zod";
import { emptyObjective } from "./authoring";

export const rubricSuggestionInput = z
  .object({
    title: z.string().trim().max(2000),
    description: z
      .string()
      .trim()
      .min(10, "Describe the scenario in at least 10 characters first.")
      .max(2000),
    learnerRole: z.string().trim().max(2000),
    botRole: z.string().trim().max(300),
    goals: z.string().trim().max(2000),
    existingCategories: z
      .array(
        z
          .object({
            title: z.string().max(150),
            description: z.string().max(2000),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();
const level = z
  .object({
    description: z.string().min(1).max(2000),
    examples: z.array(z.string().min(1).max(500)).min(1).max(3),
  })
  .strict();
export const rubricSuggestionSchema = z
  .object({
    notes: z.string().min(1).max(2000),
    categories: z
      .array(
        z
          .object({
            title: z.string().min(1).max(150),
            description: z.string().min(1).max(2000),
            required: z.boolean(),
            rationale: z.string().min(1).max(1000),
            scoringRubric: z
              .object({ not_met: level, partial: level, met: level })
              .strict(),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();
export type RubricSuggestions = z.infer<typeof rubricSuggestionSchema>;
export function suggestedObjective(
  category: RubricSuggestions["categories"][number],
  id: string,
) {
  return {
    ...emptyObjective(id),
    title: category.title,
    description: category.description,
    required: category.required,
    scoringRubric: category.scoringRubric,
    acceptableExamples: category.scoringRubric.met.examples,
    unacceptableExamples: category.scoringRubric.not_met.examples,
  };
}
