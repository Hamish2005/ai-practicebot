import { notFound } from "next/navigation";
import { ScenarioBuilder } from "../../../components/scenario-builder";
import { emptyScenario, scenarioIdSchema } from "../../../scenarios/authoring";
import { scenarioRepository } from "../../../server/scenario-repository";

export const dynamic = "force-dynamic";
export default async function NewScenario({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  let initial = emptyScenario();
  if (template) {
    if (!scenarioIdSchema.safeParse(template).success) notFound();
    const source = await scenarioRepository.get(template);
    if (!source) notFound();
    initial = {
      ...source.scenario,
      id: "draft",
      title: `${source.scenario.title} (copy)`,
    };
  }
  return (
    <ScenarioBuilder
      initialScenario={initial}
      fakeMode={(process.env.AI_PROVIDER ?? "fake") === "fake"}
    />
  );
}
