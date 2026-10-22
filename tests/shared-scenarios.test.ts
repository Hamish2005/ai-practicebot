import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const data = vi.hoisted(
  () => new Map<string, { data: unknown; etag: string }>(),
);
vi.mock("@netlify/blobs", () => ({
  getStore: () => ({
    getWithMetadata: async (key: string) =>
      structuredClone(data.get(key) ?? null),
    setJSON: async (
      key: string,
      value: unknown,
      options: { onlyIfNew?: boolean; onlyIfMatch?: string },
    ) => {
      const old = data.get(key);
      if (
        (options.onlyIfNew && old) ||
        (options.onlyIfMatch && options.onlyIfMatch !== old?.etag)
      )
        return { modified: false };
      const etag = crypto.randomUUID();
      data.set(key, { data: structuredClone(value), etag });
      return { modified: true, etag };
    },
    list: async function* () {
      yield { blobs: [...data.keys()].map((key) => ({ key })) };
    },
  }),
}));
import { createSharedScenarioRepository } from "../src/server/scenario-repository";
import { customScenario } from "./fixtures/custom-scenario";
import { duplicateCharge } from "../src/scenarios/duplicate-charge";
beforeEach(() => data.clear());

describe("hosted scenario library", () => {
  it("loads the sample without a local folder or any saved records", async () => {
    const repository = createSharedScenarioRepository();
    expect(
      (await repository.list()).map((record) => record.scenario.id),
    ).toEqual([duplicateCharge.id]);
    expect((await repository.get(duplicateCharge.id))?.builtIn).toBe(true);
  });
  it("persists custom rubrics across instances and lists them with the sample", async () => {
    const first = createSharedScenarioRepository();
    const record = await first.save(customScenario());
    const nextInstance = createSharedScenarioRepository();
    expect(await nextInstance.get(record.scenario.id)).toEqual(record);
    expect((await nextInstance.list()).map((r) => r.scenario.id)).toEqual([
      duplicateCharge.id,
      record.scenario.id,
    ]);
    expect(record.scenario.objectives[0].acceptableExamples).toEqual(
      record.scenario.objectives[0].scoringRubric!.met.examples,
    );
  });
  it("rejects simultaneous edits from separate instances without losing the winning edit", async () => {
    const a = createSharedScenarioRepository();
    const b = createSharedScenarioRepository();
    const record = await a.save(customScenario());
    const attempts = await Promise.allSettled([
      a.save({ ...record.scenario, title: "First" }, record.scenario.id, 1),
      b.save({ ...record.scenario, title: "Second" }, record.scenario.id, 1),
    ]);
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((r) => r.status === "rejected")).toHaveLength(1);
    const winner = attempts.find((r) => r.status === "fulfilled")!;
    if (winner.status === "fulfilled")
      expect(await b.get(record.scenario.id)).toEqual(winner.value);
    await expect(
      a.save(record.scenario, record.scenario.id, 1),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("protects the built-in scenario and rejects missing records and invalid identifiers", async () => {
    const repository = createSharedScenarioRepository();
    await expect(
      repository.save(duplicateCharge, duplicateCharge.id, 0),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      repository.save(customScenario(), "missing", 1),
    ).rejects.toMatchObject({ status: 404 });
    await expect(repository.get("../outside")).rejects.toThrow();
    expect(await repository.get("missing")).toBeNull();
  });
  it("reports corrupt stored rubrics rather than silently hiding them", async () => {
    data.set("broken", { data: { scenario: {} }, etag: "1" });
    await expect(createSharedScenarioRepository().list()).rejects.toThrow();
  });
});
