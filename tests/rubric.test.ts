import { describe, expect, it } from "vitest";
import { duplicateCharge } from "../src/scenarios/duplicate-charge";
import { fakeProvider } from "../src/providers/fake";
import { startSession, submitTurn } from "../src/engine/session";
import { scenarioSchema } from "../src/engine/schema";

describe("published rubric examples", () => {
  for (const objective of duplicateCharge.objectives) {
    for (const status of ["not_met", "partial", "met"] as const) {
      for (const example of objective.scoringRubric![status].examples) {
        it(`${objective.id}: ${status}: ${example}`, async () => {
          let state = startSession(duplicateCharge, "rubric", 0);
          if (objective.id === "confirm" && status === "met") {
            state = await submitTurn(
              duplicateCharge,
              state,
              "I will request a refund for the duplicate charge.",
              fakeProvider,
            );
          }
          // Bracketed text is a reviewer annotation describing the setup, not learner speech.
          const message = example.replace(/\s*\[.*?\]/g, "");
          state = await submitTurn(
            duplicateCharge,
            state,
            message,
            fakeProvider,
          );
          expect(
            state.objectives.find((a) => a.objectiveId === objective.id)
              ?.status,
          ).toBe(status);
        });
      }
    }
  }
  it("validates that a provided rubric defines all three levels", () => {
    expect(() =>
      scenarioSchema.parse({
        ...duplicateCharge,
        objectives: [
          {
            ...duplicateCharge.objectives[0],
            scoringRubric: {
              met: { description: "Full credit", examples: ["Example"] },
            },
          },
        ],
      }),
    ).toThrow();
  });
  it("does not retroactively upgrade a confirmation, but accepts a later contextual check", async () => {
    let state = startSession(duplicateCharge, "chronology", 0);
    state = await submitTurn(
      duplicateCharge,
      state,
      "Does that work for you?",
      fakeProvider,
    );
    expect(
      state.objectives.find((a) => a.objectiveId === "confirm")?.status,
    ).toBe("partial");
    state = await submitTurn(
      duplicateCharge,
      state,
      "I can refund the extra payment.",
      fakeProvider,
    );
    expect(
      state.objectives.find((a) => a.objectiveId === "confirm")?.status,
    ).toBe("partial");
    state = await submitTurn(
      duplicateCharge,
      state,
      "Is that acceptable to you?",
      fakeProvider,
    );
    expect(
      state.objectives.find((a) => a.objectiveId === "confirm")?.status,
    ).toBe("met");
  });
});
