import Link from "next/link";
import { SiteHeader } from "../../components/site-header";
import { scenarioRepository } from "../../server/scenario-repository";

export const dynamic = "force-dynamic";
export default async function ScenarioLibrary({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const records = await scenarioRepository.list();
  const saved = (await searchParams).saved;
  return (
    <>
      <SiteHeader />
      <main className="authoring-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">MSWORX LEARNING / SCENARIO LIBRARY</div>
            <h1>Build the conversations that matter.</h1>
            <p>
              Create a situation, define the skills, and give your learners room
              to practice.
            </p>
          </div>
          <Link href="/scenarios/new" className="primary">
            Build a scenario +
          </Link>
        </div>
        {saved && (
          <div className="author-notice" role="status">
            Your scenario and rubric have been saved.
          </div>
        )}
        <div className="library-grid">
          {records.map(({ scenario, builtIn, revision }) => (
            <article className="library-card" key={scenario.id}>
              <div className="library-card-top">
                <span className="eyebrow">{scenario.category}</span>
                <span className="library-badge">
                  {builtIn ? "Sample scenario" : `Version ${revision}`}
                </span>
              </div>
              <h2>{scenario.title}</h2>
              <p>{scenario.description}</p>
              <div className="library-meta">
                <span>
                  {scenario.objectives.length} scoring{" "}
                  {scenario.objectives.length === 1 ? "category" : "categories"}
                </span>
                <span>
                  {scenario.objectives.filter((o) => o.required).length}{" "}
                  required
                </span>
                <span>Up to {scenario.maximumTurns} turns</span>
              </div>
              <div className="library-actions">
                <Link className="primary" href={`/?scenario=${scenario.id}`}>
                  Practice →
                </Link>
                {!builtIn && (
                  <Link href={`/scenarios/${scenario.id}/edit`}>
                    Edit scenario
                  </Link>
                )}
                <Link href={`/scenarios/new?template=${scenario.id}`}>
                  Make a copy
                </Link>
              </div>
            </article>
          ))}
        </div>
        <div className="author-help">
          <h2>One rubric. Clear expectations.</h2>
          <p>
            Each category has a description and examples for 0, 50, and 100
            points. Required categories contribute equally to the overall score.
            Learners receive their scores even when they end early.
          </p>
          <p>
            Scenarios are saved in this workspace. Editing a scenario
            updates future sessions; conversations already started keep their
            original rubric.
          </p>
        </div>
      </main>
    </>
  );
}
