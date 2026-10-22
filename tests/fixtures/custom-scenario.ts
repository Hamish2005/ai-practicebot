import {
  emptyScenario,
  authoredScenarioSchema,
} from "../../src/scenarios/authoring";

export function customScenario() {
  return authoredScenarioSchema.parse({
    ...emptyScenario(),
    title: "Supporting a colleague",
    description: "A colleague feels overwhelmed by their workload.",
    category: "Team leadership",
    learnerRole:
      "You are the team lead. Listen and agree on a manageable next step.",
    character: { name: "Practice Bot", role: "An overwhelmed colleague" },
    openingMessage: "I cannot keep up with everything this week.",
    objectives: [
      {
        id: "empathy",
        title: "Recognize the pressure",
        description: "Recognize how the workload affects the colleague.",
        required: true,
        evaluationType: "semantic",
        minimumConfidence: 0.8,
        acceptableExamples: [],
        unacceptableExamples: [],
        scoringRubric: {
          not_met: {
            description: "No acknowledgment or dismissive language.",
            examples: ["Just work harder."],
          },
          partial: {
            description:
              "A generic acknowledgment without recognizing the pressure.",
            examples: ["I hear you."],
          },
          met: {
            description: "Recognizes the specific pressure.",
            examples: ["That workload sounds overwhelming."],
          },
        },
      },
      {
        id: "plan",
        title: "Agree on a practical step",
        description: "Offer a specific way to reduce the workload.",
        required: true,
        evaluationType: "semantic",
        minimumConfidence: 0.8,
        acceptableExamples: [],
        unacceptableExamples: [],
        scoringRubric: {
          not_met: {
            description: "No support offered.",
            examples: ["That is your problem."],
          },
          partial: {
            description: "A vague offer of support.",
            examples: ["I will help."],
          },
          met: {
            description: "A concrete change to the workload.",
            examples: ["I will move the report deadline to Friday."],
          },
        },
      },
    ],
  });
}
