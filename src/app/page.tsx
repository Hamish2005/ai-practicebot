import { TrainingRoom } from "../components/training-room";
import { notFound } from "next/navigation";
import { scenarioRepository } from "../server/scenario-repository";
import { scenarioIdSchema, summarizeScenario } from "../scenarios/authoring";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const id = (await searchParams).scenario ?? "duplicate-charge";
  if (!scenarioIdSchema.safeParse(id).success) notFound();
  const record = await scenarioRepository.get(id);
  if (!record) notFound();
  const scenario = record.scenario;
  return (
    <TrainingRoom
      key={id}
      scenario={summarizeScenario(scenario)}
      fakeMode={(process.env.AI_PROVIDER ?? "fake") === "fake"}
      trainerTitles={
        process.env.NODE_ENV === "development"
          ? Object.fromEntries(scenario.objectives.map((o) => [o.id, o.title]))
          : null
      }
    />
  );
}
