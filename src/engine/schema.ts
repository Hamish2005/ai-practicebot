import { z } from "zod";

export const statusSchema = z.enum(["not_met", "partial", "met"]);
const objectiveSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    required: z.boolean(),
    evaluationType: z.enum(["semantic", "exact_phrase"]),
    acceptableExamples: z.array(z.string()),
    unacceptableExamples: z.array(z.string()),
    scoringRubric: z
      .object({
        not_met: z.object({
          description: z.string().min(1),
          examples: z.array(z.string().min(1)).min(1),
        }),
        partial: z.object({
          description: z.string().min(1),
          examples: z.array(z.string().min(1)).min(1),
        }),
        met: z.object({
          description: z.string().min(1),
          examples: z.array(z.string().min(1)).min(1),
        }),
      })
      .optional(),
    exactPhrases: z.array(z.string().min(1)).optional(),
    minimumConfidence: z.number().min(0).max(1),
  })
  .refine(
    (o) =>
      o.evaluationType !== "exact_phrase" || Boolean(o.exactPhrases?.length),
    "Exact-phrase objectives require phrases",
  );
export const scenarioSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    character: z.object({ name: z.string().min(1), role: z.string().min(1) }),
    category: z.string().min(1).default("Customer experience"),
    learnerRole: z
      .string()
      .min(1)
      .default(
        "You are the support representative. Respond naturally and guide the conversation toward a resolution.",
      ),
    openingMessage: z.string().min(1),
    conversationInstructions: z.string().min(1),
    maximumTurns: z.number().int().positive(),
    maximumConsecutiveOffTopicTurns: z.number().int().min(2),
    offTopicWarningAt: z.number().int().positive(),
    offTopicConfidenceThreshold: z.number().min(0).max(1).default(0.8),
    allowObjectiveRegression: z.boolean().default(false),
    objectives: z.array(objectiveSchema).min(1),
    completionMessage: z.string().min(1),
    incompleteSessionMessage: z.string().min(1),
  })
  .refine(
    (s) => s.offTopicWarningAt < s.maximumConsecutiveOffTopicTurns,
    "Warning must precede termination",
  )
  .refine(
    (s) => new Set(s.objectives.map((o) => o.id)).size === s.objectives.length,
    "Objective IDs must be unique",
  )
  .refine(
    (s) => s.objectives.some((o) => o.required),
    "At least one required objective is needed",
  );
export const assessmentSchema = z.object({
  objectiveId: z.string(),
  status: statusSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.string().nullable(),
  reasoning: z.string(),
});
export const evaluationSchema = z.object({
  objectives: z.array(assessmentSchema),
  offTopic: z.boolean(),
  offTopicConfidence: z.number().min(0).max(1),
  safetyViolation: z.boolean(),
  safetyReason: z.string().nullable(),
});
export const messageSchema = z
  .string()
  .trim()
  .min(1, "Enter a message.")
  .max(4000, "Keep messages under 4,000 characters.");
export type Scenario = z.infer<typeof scenarioSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type EvaluationResult = z.infer<typeof evaluationSchema>;
