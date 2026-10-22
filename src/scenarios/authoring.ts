import { z } from "zod";
import { scenarioSchema, type Scenario } from "../engine/schema";

export const scenarioIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,79}$/, "Invalid scenario identifier.");
export const authoredScenarioSchema = scenarioSchema.superRefine(
  (scenario, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });
    if (scenario.objectives.length > 12)
      issue(["objectives"], "Use at most 12 categories.");
    if (scenario.maximumTurns > 30)
      issue(["maximumTurns"], "Use at most 30 turns.");
    if (scenario.maximumConsecutiveOffTopicTurns > 10)
      issue(
        ["maximumConsecutiveOffTopicTurns"],
        "Use at most 10 off-topic turns.",
      );
    for (const field of [
      "title",
      "description",
      "learnerRole",
      "category",
      "openingMessage",
      "conversationInstructions",
      "completionMessage",
      "incompleteSessionMessage",
    ] as const) {
      if (!scenario[field].trim())
        issue([field], "This field cannot be blank.");
      if (
        scenario[field].length >
        (field === "conversationInstructions" ? 4000 : 2000)
      )
        issue([field], "This field is too long.");
    }
    if (scenario.character.name !== "Practice Bot")
      issue(["character", "name"], "The character name must be Practice Bot.");
    if (!scenario.character.role.trim() || scenario.character.role.length > 300)
      issue(["character", "role"], "Enter a role of 1–300 characters.");
    scenario.objectives.forEach((objective, i) => {
      if (!objective.title.trim() || !objective.description.trim())
        issue(
          ["objectives", i],
          "Each category needs a title and description.",
        );
      if (objective.title.length > 150 || objective.description.length > 2000)
        issue(["objectives", i], "Category title or description is too long.");
      if (!objective.scoringRubric) {
        issue(
          ["objectives", i, "scoringRubric"],
          "Define all three scoring levels.",
        );
        return;
      }
      for (const level of ["not_met", "partial", "met"] as const) {
        const rubric = objective.scoringRubric[level];
        if (!rubric.description.trim() || rubric.description.length > 2000)
          issue(
            ["objectives", i, "scoringRubric", level, "description"],
            "Enter a criterion of 1–2,000 characters.",
          );
        if (
          rubric.examples.length > 5 ||
          rubric.examples.some(
            (example) => !example.trim() || example.length > 500,
          )
        )
          issue(
            ["objectives", i, "scoringRubric", level, "examples"],
            "Use 1–5 examples of up to 500 characters each.",
          );
      }
    });
  },
);
export type ScenarioRecord = {
  scenario: Scenario;
  revision: number;
  updatedAt: string | null;
  builtIn: boolean;
};
export function summarizeScenario(scenario: Scenario) {
  return {
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    category: scenario.category,
    learnerRole: scenario.learnerRole,
    character: scenario.character,
    maximumTurns: scenario.maximumTurns,
  };
}
export type ScenarioSummary = ReturnType<typeof summarizeScenario>;

export function emptyObjective(id: string): Scenario["objectives"][number] {
  return {
    id,
    title: "",
    description: "",
    required: true,
    evaluationType: "semantic",
    minimumConfidence: 0.8,
    acceptableExamples: [],
    unacceptableExamples: [],
    scoringRubric: {
      not_met: { description: "", examples: [""] },
      partial: { description: "", examples: [""] },
      met: { description: "", examples: [""] },
    },
  };
}
export function emptyScenario(): Scenario {
  return {
    id: "draft",
    title: "",
    description: "",
    category: "Conversation practice",
    learnerRole: "",
    character: { name: "Practice Bot", role: "" },
    openingMessage: "",
    conversationInstructions:
      "Stay in the assigned role. Respond naturally and acknowledge what the learner has already said. Ask relevant follow-up questions without revealing the rubric. Never claim a real-world action has happened.",
    maximumTurns: 10,
    maximumConsecutiveOffTopicTurns: 3,
    offTopicWarningAt: 2,
    offTopicConfidenceThreshold: 0.8,
    allowObjectiveRegression: false,
    objectives: [emptyObjective("category-1")],
    completionMessage:
      "You demonstrated all required skills. Review your strengths below.",
    incompleteSessionMessage:
      "Review the skills you demonstrated and the opportunities for your next practice.",
  };
}

export function isBlankObjective(objective: Scenario["objectives"][number]) {
  return (
    JSON.stringify(objective) === JSON.stringify(emptyObjective(objective.id))
  );
}
