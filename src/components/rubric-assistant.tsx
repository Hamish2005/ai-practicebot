"use client";
import { useEffect, useRef, useState } from "react";
import type { Scenario } from "../engine/schema";
import { isBlankObjective } from "../scenarios/authoring";
import {
  rubricSuggestionInput,
  rubricSuggestionSchema,
  suggestedObjective,
  type RubricSuggestions,
} from "../scenarios/rubric-suggestions";

export function RubricAssistant({
  draft,
  onAdd,
}: {
  draft: Scenario;
  onAdd: (objective: Scenario["objectives"][number]) => void;
}) {
  const [goals, setGoals] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RubricSuggestions | null>(null);
  const [added, setAdded] = useState<number[]>([]);
  const [source, setSource] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const scene = JSON.stringify({
    title: draft.title,
    description: draft.description,
    learnerRole: draft.learnerRole,
    botRole: draft.character.role,
    goals,
  });
  const stale = Boolean(result && source !== scene);
  async function generate() {
    if (controller.current) return;
    const parsed = rubricSuggestionInput.safeParse({
      ...JSON.parse(scene),
      existingCategories: draft.objectives
        .filter((o) => o.title.trim())
        .map((o) => ({ title: o.title, description: o.description })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/scenarios/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: active.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not generate suggestions.");
      const suggestions = rubricSuggestionSchema.parse(data.suggestions);
      if (active.signal.aborted) return;
      setResult(suggestions);
      setSource(scene);
      setAdded([]);
    } catch (e) {
      if (!active.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Could not generate suggestions.",
        );
    } finally {
      if (!active.signal.aborted) setLoading(false);
      if (controller.current === active) controller.current = null;
    }
  }
  const realCount = draft.objectives.filter((o) => !isBlankObjective(o)).length;
  return (
    <div className="rubric-assistant">
      <h3>Get a head start with Practice Bot</h3>
      <p>
        Use the scene above to suggest categories, criteria, and examples for 0,
        50, and 100. Review each suggestion before adding it to your editable
        rubric.
      </p>
      <label>
        Skills or priorities to focus on (optional)
        <textarea
          rows={2}
          maxLength={2000}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="For example: show empathy, explain the next step, and check agreement"
        />
      </label>
      <button
        type="button"
        className="secondary"
        disabled={loading}
        onClick={() => void generate()}
      >
        {loading
          ? "Preparing suggestions…"
          : "Suggest rubric with Practice Bot"}
      </button>
      {loading && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            controller.current?.abort();
            controller.current = null;
            setLoading(false);
          }}
        >
          Cancel suggestions
        </button>
      )}
      <p className="builder-hint">
        Practice Bot suggests a starting point for your review. Nothing is saved
        until you save the scenario.
      </p>
      {error && <p role="alert">{error}</p>}
      {loading && (
        <p role="status">
          Drafting scoring examples… You can keep editing your scene.
        </p>
      )}
      {result && (
        <div aria-label="Practice Bot rubric suggestions">
          <p>
            <strong>Review notes:</strong> {result.notes}
          </p>
          {stale && (
            <p role="status">
              The scene or priorities changed. Generate fresh suggestions before
              adding categories.
            </p>
          )}
          {result.categories.map((category, index) => {
            const duplicate = draft.objectives.some(
              (o) =>
                o.title.trim().toLowerCase() ===
                category.title.trim().toLowerCase(),
            );
            const used = added.includes(index);
            return (
              <article className="rubric-suggestion" key={index}>
                <h4>
                  {category.title}{" "}
                  <small>{category.required ? "Required" : "Optional"}</small>
                </h4>
                <p>{category.description}</p>
                <p className="builder-hint">{category.rationale}</p>
                {(["not_met", "partial", "met"] as const).map((level, i) => (
                  <div key={level}>
                    <strong>{[0, 50, 100][i]} points</strong>
                    <p>{category.scoringRubric[level].description}</p>
                    <ul>
                      {category.scoringRubric[level].examples.map(
                        (example, j) => (
                          <li key={j}>{example}</li>
                        ),
                      )}
                    </ul>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  disabled={
                    loading || stale || used || duplicate || realCount >= 12
                  }
                  onClick={() => {
                    onAdd(suggestedObjective(category, crypto.randomUUID()));
                    setAdded((previous) => [...previous, index]);
                  }}
                >
                  {used
                    ? "Added to rubric"
                    : duplicate
                      ? "Already in rubric"
                      : `Add ${category.title}`}
                </button>
              </article>
            );
          })}
          {realCount >= 12 && (
            <p>Remove a category before adding another; the limit is 12.</p>
          )}
        </div>
      )}
    </div>
  );
}
