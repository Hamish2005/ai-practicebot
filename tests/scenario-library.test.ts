import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { NextRequest } from "next/server";
import {
  createScenarioRepository,
  scenarioRepository,
} from "../src/server/scenario-repository";
import { authoredScenarioSchema } from "../src/scenarios/authoring";
import { customScenario } from "./fixtures/custom-scenario";
import { duplicateCharge } from "../src/scenarios/duplicate-charge";
import {
  POST as sessionPost,
  GET as sessionGet,
} from "../src/app/api/session/route";
import { POST as createPost } from "../src/app/api/scenarios/route";
import { PUT as updatePut } from "../src/app/api/scenarios/[id]/route";
import { sessions } from "../src/server/store";

let directory: string;
let repository: ReturnType<typeof createScenarioRepository>;
const request = (
  body: unknown,
  id?: string,
  origin = "http://localhost:3000",
) =>
  new NextRequest("http://localhost:3000/api/session", {
    method: "POST",
    headers: { origin, ...(id ? { cookie: `practice_session=${id}` } : {}) },
    body: JSON.stringify(body),
  });
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "practice-scenario-test-"));
  repository = createScenarioRepository(directory);
  vi.spyOn(scenarioRepository, "get").mockImplementation(repository.get);
  vi.spyOn(scenarioRepository, "save").mockImplementation(repository.save);
  vi.stubEnv("AI_PROVIDER", "fake");
  sessions.clear();
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  sessions.clear();
  const target = resolve(directory);
  if (
    !target.startsWith(resolve(tmpdir()) + sep) ||
    !target.includes("practice-scenario-test-")
  )
    throw new Error("Unexpected test cleanup path.");
  await rm(target, { recursive: true, force: true });
});

describe("scenario authoring and persistence", () => {
  it("saves custom rubrics and reloads them through a fresh repository instance", async () => {
    const record = await repository.save(customScenario());
    const reopened = createScenarioRepository(directory);
    expect(
      (await reopened.get(record.scenario.id))?.scenario.objectives[0]
        .scoringRubric,
    ).toEqual(customScenario().objectives[0].scoringRubric);
    expect((await reopened.list()).map((r) => r.scenario.title)).toEqual([
      duplicateCharge.title,
      "Supporting a colleague",
    ]);
    expect(record.scenario.objectives[0].acceptableExamples).toEqual([
      "That workload sounds overwhelming.",
    ]);
  });
  it("updates with revisions and rejects stale concurrent edits", async () => {
    const record = await repository.save(customScenario());
    const results = await Promise.allSettled([
      repository.save(
        { ...record.scenario, title: "Updated" },
        record.scenario.id,
        1,
      ),
      repository.save(
        { ...record.scenario, title: "Conflicting" },
        record.scenario.id,
        1,
      ),
    ]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
    expect((await repository.get(record.scenario.id))?.revision).toBe(2);
  });
  it("protects the sample and rejects path traversal", async () => {
    await expect(
      repository.save(duplicateCharge, duplicateCharge.id, 0),
    ).rejects.toMatchObject({ status: 403 });
    await expect(repository.get("../outside")).rejects.toThrow();
    expect(await repository.get("missing")).toBeNull();
  });
  it("rejects missing rubric levels, empty criteria, all-optional categories, and invalid warning thresholds", () => {
    const base = customScenario();
    for (const value of [
      {
        ...base,
        objectives: base.objectives.map((o) => ({
          ...o,
          scoringRubric: undefined,
        })),
      },
      {
        ...base,
        objectives: base.objectives.map((o) => ({ ...o, required: false })),
      },
      { ...base, offTopicWarningAt: 3 },
      {
        ...base,
        objectives: [
          {
            ...base.objectives[0],
            scoringRubric: {
              ...base.objectives[0].scoringRubric,
              partial: { description: " ", examples: [""] },
            },
          },
        ],
      },
    ])
      expect(authoredScenarioSchema.safeParse(value).success).toBe(false);
  });
  it("reports corrupted files rather than dropping saved scenarios silently", async () => {
    await writeFile(join(directory, "corrupted.json"), "{broken");
    await expect(repository.list()).rejects.toMatchObject({ status: 500 });
  });
});

describe("scenario selection API", () => {
  it("creates and edits a scenario with server validation", async () => {
    const response = await createPost(request({ scenario: customScenario() }));
    expect(response.status).toBe(201);
    const { record } = await response.json();
    const edited = await updatePut(
      request({
        scenario: { ...record.scenario, title: "Changed title" },
        revision: 1,
      }),
      { params: Promise.resolve({ id: record.scenario.id }) },
    );
    expect(edited.status).toBe(200);
    expect((await edited.json()).record.revision).toBe(2);
    const stale = await updatePut(
      request({ scenario: record.scenario, revision: 1 }),
      { params: Promise.resolve({ id: record.scenario.id }) },
    );
    expect(stale.status).toBe(409);
    expect(
      (
        await createPost(
          request({ scenario: { ...customScenario(), objectives: [] } }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await createPost(
          request(
            { scenario: customScenario() },
            undefined,
            "https://elsewhere.example",
          ),
        )
      ).status,
    ).toBe(403);
  });
  it("keeps the selected scenario and rubric snapshot when the saved scenario changes", async () => {
    const record = await repository.save(customScenario());
    const started = (
      await (
        await sessionPost(
          request({ action: "start", scenarioId: record.scenario.id }),
        )
      ).json()
    ).session;
    expect(started.transcript[0].content).toBe(record.scenario.openingMessage);
    await repository.save(
      {
        ...record.scenario,
        title: "A different title",
        maximumTurns: 1,
        objectives: [record.scenario.objectives[0]],
      },
      record.scenario.id,
      1,
    );
    const turn = (
      await (
        await sessionPost(
          request(
            {
              action: "turn",
              revision: 0,
              message: "That workload sounds overwhelming.",
            },
            started.id,
          ),
        )
      ).json()
    ).session;
    expect(turn.endedAt).toBeNull();
    expect(turn.scenario.title).toBe("Supporting a colleague");
    const ended = (
      await (
        await sessionPost(request({ action: "end", revision: 1 }, started.id))
      ).json()
    ).session;
    expect(ended.feedback.overallScore).toBe(50);
    expect(
      ended.feedback.assessments.map((a: { score: number }) => a.score),
    ).toEqual([100, 0]);
    const restored = await sessionGet(
      new NextRequest("http://localhost:3000/api/session", {
        headers: { cookie: `practice_session=${started.id}` },
      }),
    );
    expect((await restored.json()).session.scenario.title).toBe(
      "Supporting a colleague",
    );
    const restarted = (
      await (
        await sessionPost(
          request(
            { action: "start", scenarioId: record.scenario.id },
            started.id,
          ),
        )
      ).json()
    ).session;
    expect(restarted.scenario.title).toBe("A different title");
    expect(restarted.scenario.maximumTurns).toBe(1);
  });
  it("does not expose a custom rubric in the normal production session response", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const record = await repository.save(customScenario());
    const state = (
      await (
        await sessionPost(
          request({ action: "start", scenarioId: record.scenario.id }),
        )
      ).json()
    ).session;
    expect(state.trainer).toBeNull();
    expect(state.scenario.objectives).toBeUndefined();
    expect(JSON.stringify(state)).not.toContain("scoringRubric");
  });
  it("rejects unknown or invalid selections", async () => {
    expect(
      (await sessionPost(request({ action: "start", scenarioId: "missing" })))
        .status,
    ).toBe(404);
    expect(
      (
        await sessionPost(
          request({ action: "start", scenarioId: "../../file" }),
        )
      ).status,
    ).toBe(400);
  });
});
