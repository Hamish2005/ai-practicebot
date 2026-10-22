import { notFound, redirect } from "next/navigation";
import { ScenarioBuilder } from "../../../../components/scenario-builder";
import { scenarioIdSchema } from "../../../../scenarios/authoring";
import { scenarioRepository } from "../../../../server/scenario-repository";

export const dynamic = "force-dynamic";
export default async function EditScenario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!scenarioIdSchema.safeParse(id).success) notFound();
  const record = await scenarioRepository.get(id);
  if (!record) notFound();
  if (record.builtIn) redirect(`/scenarios/new?template=${id}`);
  return (
    <ScenarioBuilder
      initialScenario={record.scenario}
      revision={record.revision}
      recordId={id}
      fakeMode={(process.env.AI_PROVIDER ?? "fake") === "fake"}
    />
  );
}
