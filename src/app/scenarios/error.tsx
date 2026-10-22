"use client";
export default function ScenarioError({ reset }: { reset: () => void }) {
  return (
    <main className="authoring-page">
      <h1>We couldn’t load the scenario library.</h1>
      <p>Check that the local scenario files are readable, then retry.</p>
      <button className="primary" onClick={reset}>
        Retry
      </button>
    </main>
  );
}
