import { describe, expect, it } from "vitest";
import { createFeedback } from "../src/engine/feedback";
import { startSession, submitTurn, finishSession } from "../src/engine/session";
import { duplicateCharge as scenario } from "../src/scenarios/duplicate-charge";
import { fakeProvider, demoMessages } from "../src/providers/fake";
import type { EndReason } from "../src/engine/types";

describe("category scoring", () => {
  it("keeps full and partial credit when the learner ends early", async () => {
    let state = startSession(scenario, "scoring", 0);
    state = await submitTurn(
      scenario,
      state,
      `${demoMessages[0]} I will fix it.`,
      fakeProvider,
    );
    const feedback = finishSession(
      scenario,
      state,
      "complete_user",
      1000,
    ).feedback!;
    expect(feedback.assessments.map((a) => a.score)).toEqual([
      100, 100, 50, 0, 0,
    ]);
    expect(feedback.overallScore).toBe(50);
    expect(feedback.successful).toBe(false);
    expect(feedback.assessedTurns).toBe(1);
    expect(feedback.assessments[2].evidence).toBe("I will fix it.");
  });
  it("returns a score for every category when no replies were submitted", () => {
    const feedback = finishSession(
      scenario,
      startSession(scenario, "empty", 0),
      "complete_user",
      1000,
    ).feedback!;
    expect(feedback.overallScore).toBe(0);
    expect(feedback.assessments).toHaveLength(5);
    expect(
      feedback.assessments.every((a) => a.score === 0 && a.evidence === null),
    ).toBe(true);
    expect(feedback.summary).toContain("No replies were submitted");
  });
  it("uses validated skill status rather than confidence as a score", () => {
    const state = startSession(scenario, "confidence", 0);
    state.objectives[0] = {
      ...state.objectives[0],
      status: "partial",
      confidence: 0.99,
    };
    state.objectives[1] = {
      ...state.objectives[1],
      status: "met",
      confidence: 0.81,
    };
    const feedback = createFeedback(scenario, state, "complete_user");
    expect(feedback.assessments[0].score).toBe(50);
    expect(feedback.assessments[1].score).toBe(100);
  });
  it.each<EndReason>([
    "complete_user",
    "complete_turn_limit",
    "complete_off_topic",
    "complete_safety",
    "complete_success",
  ])("applies the same scoring formula for %s", (reason) => {
    const state = startSession(scenario, "end-reason", 0);
    state.objectives[0].status = "met";
    expect(createFeedback(scenario, state, reason).overallScore).toBe(20);
  });
  it("reports optional category scores without including them in the required-category average", () => {
    const config = {
      ...scenario,
      objectives: scenario.objectives.map((o, i) => ({
        ...o,
        required: i !== 0,
      })),
    };
    const state = startSession(config, "optional", 0);
    state.objectives = state.objectives.map((a, i) => ({
      ...a,
      status: i === 0 ? "not_met" : "met",
    }));
    const feedback = createFeedback(config, state, "complete_success");
    expect(feedback.overallScore).toBe(100);
    expect(feedback.assessments[0]).toMatchObject({
      score: 0,
      required: false,
    });
  });
});
