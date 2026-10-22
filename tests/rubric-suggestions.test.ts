import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../src/server/rubric-suggestions", () => ({ suggestRubric: vi.fn() }));
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/scenarios/suggestions/route";
import { suggestRubric } from "../src/server/rubric-suggestions";
import {
  rubricSuggestionSchema,
  suggestedObjective,
} from "../src/scenarios/rubric-suggestions";
import { duplicateCharge } from "../src/scenarios/duplicate-charge";
import {
  authoredScenarioSchema,
  emptyObjective,
  isBlankObjective,
} from "../src/scenarios/authoring";
const objective = duplicateCharge.objectives[0];
const suggestions = {
  notes: "Review with your trainer.",
  categories: [
    {
      title: objective.title,
      description: objective.description,
      required: true,
      rationale: "Recognize the concern.",
      scoringRubric: objective.scoringRubric!,
    },
  ],
};
const input = {
  title: "Support",
  description: "A customer was charged twice.",
  learnerRole: "Support representative",
  botRole: "Customer",
  goals: "",
  existingCategories: [],
};
const request = (body: unknown, origin = "http://localhost:3000") =>
  new NextRequest("http://localhost:3000/api/scenarios/suggestions", {
    method: "POST",
    headers: { origin },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AI_PROVIDER", "openai");
  vi.stubEnv("OPENAI_API_KEY", "test-placeholder");
  vi.mocked(suggestRubric).mockResolvedValue(suggestions);
});
it("returns reviewable suggestions without needing a saved scenario", async () => {
  const result = await POST(request(input));
  expect(result.status).toBe(200);
  expect((await result.json()).suggestions).toEqual(suggestions);
  expect(result.headers.get("cache-control")).toBe("no-store");
});
it("rejects insufficient context, oversized requests and foreign origins before provider calls", async () => {
  expect((await POST(request({ ...input, description: "" }))).status).toBe(400);
  expect(
    (await POST(request({ ...input, goals: "a".repeat(101000) }))).status,
  ).toBe(413);
  expect((await POST(request(input, "https://other.example"))).status).toBe(
    403,
  );
  expect(suggestRubric).not.toHaveBeenCalled();
});
it("supports offline authoring with a clear suggestions error", async () => {
  vi.stubEnv("AI_PROVIDER", "fake");
  expect((await POST(request(input))).status).toBe(503);
  expect(suggestRubric).not.toHaveBeenCalled();
});
it("does not expose provider errors and permits retry", async () => {
  vi.mocked(suggestRubric).mockRejectedValueOnce(
    new Error("private provider details"),
  );
  const response = await POST(request(input));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private provider details");
  expect((await POST(request(input))).status).toBe(200);
});
it("converts suggestions into valid editable scoring categories", () => {
  const parsed = rubricSuggestionSchema.parse(suggestions);
  const converted = suggestedObjective(parsed.categories[0], "suggestion-1");
  expect(
    authoredScenarioSchema.safeParse({
      ...duplicateCharge,
      objectives: [converted],
    }).success,
  ).toBe(true);
  expect(converted.acceptableExamples).toEqual(
    objective.scoringRubric!.met.examples,
  );
  expect(converted.minimumConfidence).toBe(0.8);
});
it("only removes pristine placeholders, preserving incomplete manual work", () => {
  expect(isBlankObjective(emptyObjective("blank"))).toBe(true);
  expect(
    isBlankObjective({
      ...emptyObjective("edited"),
      exactPhrases: ["hello"],
      evaluationType: "exact_phrase",
    }),
  ).toBe(false);
  expect(
    isBlankObjective({ ...emptyObjective("edited"), required: false }),
  ).toBe(false);
});
