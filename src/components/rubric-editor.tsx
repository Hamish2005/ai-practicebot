"use client";
import type { Scenario } from "../engine/schema";

type Objective = Scenario["objectives"][number];
export function RubricEditor({
  objective,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  objective: Objective;
  index: number;
  canRemove: boolean;
  onChange: (objective: Objective) => void;
  onRemove: () => void;
}) {
  const rubric = objective.scoringRubric!;
  return (
    <fieldset className="rubric-editor">
      <legend>Category {index + 1}</legend>
      <div className="rubric-heading">
        <label>
          Category title
          <input
            required
            maxLength={150}
            value={objective.title}
            onChange={(e) => onChange({ ...objective, title: e.target.value })}
            placeholder="For example: Show empathy"
          />
        </label>
        <button
          type="button"
          className="remove-category"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label={`Remove category ${index + 1}`}
        >
          Remove
        </button>
      </div>
      <label>
        What should the learner demonstrate?
        <textarea
          required
          rows={2}
          maxLength={2000}
          value={objective.description}
          onChange={(e) =>
            onChange({ ...objective, description: e.target.value })
          }
          placeholder="Describe an observable behavior, not a keyword."
        />
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={objective.required}
          onChange={(e) =>
            onChange({ ...objective, required: e.target.checked })
          }
        />
        Required for successful completion and included in the overall score
      </label>
      <div className="rubric-levels">
        {(
          [
            { status: "not_met", score: 0, title: "Not demonstrated" },
            { status: "partial", score: 50, title: "Partially demonstrated" },
            { status: "met", score: 100, title: "Demonstrated" },
          ] as const
        ).map(({ status, score, title }) => (
          <div className="rubric-level" key={status}>
            <div className="rubric-level-title">
              <strong>{score}</strong>
              <span>{title}</span>
            </div>
            <label>
              {`${score}-point criterion`}
              <textarea
                required
                rows={4}
                maxLength={2000}
                aria-label={`${score}-point criterion`}
                value={rubric[status].description}
                onChange={(e) =>
                  onChange({
                    ...objective,
                    scoringRubric: {
                      ...rubric,
                      [status]: {
                        ...rubric[status],
                        description: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Explain why this level earns this score."
              />
            </label>
            <label>
              {`${score}-point examples`}
              <textarea
                required
                rows={4}
                value={rubric[status].examples.join("\n")}
                aria-label={`${score}-point examples`}
                onChange={(e) =>
                  onChange({
                    ...objective,
                    scoringRubric: {
                      ...rubric,
                      [status]: {
                        ...rubric[status],
                        examples: e.target.value.split("\n"),
                      },
                    },
                  })
                }
                placeholder="One example reply per line (up to 5)."
              />
            </label>
          </div>
        ))}
      </div>
      <details className="scoring-options">
        <summary>Advanced scoring options</summary>
        <div className="builder-grid">
          <label>
            Evaluation method
            <select
              value={objective.evaluationType}
              onChange={(e) =>
                onChange({
                  ...objective,
                  evaluationType: e.target.value as Objective["evaluationType"],
                })
              }
            >
              <option value="semantic">Meaning and behavior</option>
              <option value="exact_phrase">Meaning plus an exact phrase</option>
            </select>
          </label>
          <label>
            Minimum confidence for full credit
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={objective.minimumConfidence}
              onChange={(e) =>
                onChange({
                  ...objective,
                  minimumConfidence: Number(e.target.value),
                })
              }
            />
          </label>
          {objective.evaluationType === "exact_phrase" && (
            <label>
              Required phrases (one per line)
              <textarea
                required
                value={objective.exactPhrases?.join("\n") ?? ""}
                onChange={(e) =>
                  onChange({
                    ...objective,
                    exactPhrases: e.target.value.split("\n"),
                  })
                }
              />
            </label>
          )}
        </div>
        <p>Confidence is the evaluator’s certainty, not the learner’s grade.</p>
      </details>
    </fieldset>
  );
}
