import "server-only";
import { getStore } from "@netlify/blobs";
import { sharedSessionsEnabled } from "./store";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { duplicateCharge } from "../scenarios/duplicate-charge";
import {
  authoredScenarioSchema,
  scenarioIdSchema,
  type ScenarioRecord,
} from "../scenarios/authoring";
import type { Scenario } from "../engine/schema";

export class ScenarioStoreError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const storedSchema = z.object({
  scenario: authoredScenarioSchema,
  revision: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  builtIn: z.literal(false),
});
const builtIn: ScenarioRecord = {
  scenario: duplicateCharge,
  revision: 0,
  updatedAt: null,
  builtIn: true,
};

export function createScenarioRepository(directory: string) {
  let pending: Promise<unknown> = Promise.resolve();
  async function get(id: string): Promise<ScenarioRecord | null> {
    scenarioIdSchema.parse(id);
    if (id === duplicateCharge.id) return structuredClone(builtIn);
    try {
      const record = storedSchema.parse(
        JSON.parse(await readFile(join(directory, `${id}.json`), "utf8")),
      );
      if (record.scenario.id !== id)
        throw new Error("Scenario ID does not match its file.");
      return record;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new ScenarioStoreError(
        "A saved scenario could not be read. Check the scenario data files before trying again.",
        500,
      );
    }
  }
  async function list(): Promise<ScenarioRecord[]> {
    await mkdir(directory, { recursive: true });
    const ids = (await readdir(directory))
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -5));
    const custom = await Promise.all(ids.map(get));
    return [
      structuredClone(builtIn),
      ...custom
        .filter(
          (record): record is ScenarioRecord =>
            record !== null && !record.builtIn,
        )
        .sort((a, b) => a.scenario.title.localeCompare(b.scenario.title)),
    ];
  }
  function save(
    scenario: Scenario,
    id?: string,
    revision?: number,
  ): Promise<ScenarioRecord> {
    const operation = pending.then(async () => {
      const parsed = authoredScenarioSchema.parse(scenario);
      const key = id ? scenarioIdSchema.parse(id) : randomUUID();
      const existing = id ? await get(key) : null;
      if (existing?.builtIn)
        throw new ScenarioStoreError(
          "Duplicate the sample scenario to customize it.",
          403,
        );
      if (id && !existing)
        throw new ScenarioStoreError("Scenario not found.", 404);
      if (existing && revision !== existing.revision)
        throw new ScenarioStoreError(
          "This scenario was edited elsewhere. Reload the editor before saving again.",
          409,
        );
      const record: ScenarioRecord = {
        scenario: {
          ...parsed,
          id: key,
          objectives: parsed.objectives.map((o) => ({
            ...o,
            acceptableExamples: o.scoringRubric!.met.examples,
            unacceptableExamples: o.scoringRubric!.not_met.examples,
          })),
        },
        revision: (existing?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        builtIn: false,
      };
      await mkdir(directory, { recursive: true });
      const temporary = join(directory, `${key}.${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, JSON.stringify(record, null, 2) + "\n", {
          flag: "wx",
        });
        await rename(temporary, join(directory, `${key}.json`));
      } catch (error) {
        try {
          await unlink(temporary);
        } catch (cleanupError) {
          if ((cleanupError as NodeJS.ErrnoException).code !== "ENOENT")
            console.error("Could not remove temporary scenario file.");
        }
        throw error;
      }
      return record;
    });
    // Continue the queue after a failure; the caller still receives the rejected operation.
    pending = operation.catch(() => undefined);
    return operation;
  }
  return { get, list, save };
}
export function createSharedScenarioRepository(
  store = getStore({ name: "practice-scenarios", consistency: "strong" }),
) {
  async function read(id: string) {
    scenarioIdSchema.parse(id);
    const saved = await store.getWithMetadata(id, { type: "json" });
    if (!saved) return null;
    const record = storedSchema.parse(saved.data);
    if (record.scenario.id !== id || !saved.etag)
      throw new ScenarioStoreError(
        "A saved scenario could not be read. Please retry.",
        500,
      );
    return { record, etag: saved.etag };
  }
  async function get(id: string): Promise<ScenarioRecord | null> {
    scenarioIdSchema.parse(id);
    if (id === duplicateCharge.id) return structuredClone(builtIn);
    return (await read(id))?.record ?? null;
  }
  async function list(): Promise<ScenarioRecord[]> {
    const custom: ScenarioRecord[] = [];
    for await (const page of store.list({ paginate: true })) {
      const records = await Promise.all(page.blobs.map(({ key }) => get(key)));
      custom.push(
        ...records.filter(
          (record): record is ScenarioRecord =>
            record !== null && !record.builtIn,
        ),
      );
    }
    return [
      structuredClone(builtIn),
      ...custom.sort((a, b) =>
        a.scenario.title.localeCompare(b.scenario.title),
      ),
    ];
  }
  async function save(
    scenario: Scenario,
    id?: string,
    revision?: number,
  ): Promise<ScenarioRecord> {
    const parsed = authoredScenarioSchema.parse(scenario);
    const key = id ? scenarioIdSchema.parse(id) : randomUUID();
    if (key === duplicateCharge.id)
      throw new ScenarioStoreError(
        "Duplicate the sample scenario to customize it.",
        403,
      );
    const existing = id ? await read(key) : null;
    if (id && !existing)
      throw new ScenarioStoreError("Scenario not found.", 404);
    const conflict = () =>
      new ScenarioStoreError(
        "This scenario was edited elsewhere. Reload the editor before saving again.",
        409,
      );
    if (existing && revision !== existing.record.revision) throw conflict();
    const record: ScenarioRecord = {
      scenario: {
        ...parsed,
        id: key,
        objectives: parsed.objectives.map((o) => ({
          ...o,
          acceptableExamples: o.scoringRubric!.met.examples,
          unacceptableExamples: o.scoringRubric!.not_met.examples,
        })),
      },
      revision: (existing?.record.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      builtIn: false,
    };
    const result = await store.setJSON(
      key,
      record,
      existing ? { onlyIfMatch: existing.etag } : { onlyIfNew: true },
    );
    if (!result.modified) throw conflict();
    return record;
  }
  return { get, list, save };
}
const scope = globalThis as unknown as {
  practiceScenarioRepository?: ReturnType<typeof createScenarioRepository>;
};
let shared: ReturnType<typeof createSharedScenarioRepository> | undefined;
function repository() {
  if (sharedSessionsEnabled())
    return (shared ??= createSharedScenarioRepository());
  return (scope.practiceScenarioRepository ??= createScenarioRepository(
    process.env.SCENARIO_DATA_DIR?.trim() ||
      join(process.cwd(), "data", "scenarios"),
  ));
}
export const scenarioRepository: ReturnType<typeof createScenarioRepository> = {
  get: (id) => repository().get(id),
  list: () => repository().list(),
  save: (scenario, id, revision) => repository().save(scenario, id, revision),
};
