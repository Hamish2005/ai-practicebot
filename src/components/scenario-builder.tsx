"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Scenario } from "../engine/schema";
import {
  authoredScenarioSchema,
  emptyObjective,
  isBlankObjective,
} from "../scenarios/authoring";
import { SiteHeader } from "./site-header";
import { RubricEditor } from "./rubric-editor";
import { RubricAssistant } from "./rubric-assistant";

export function ScenarioBuilder({
  initialScenario,
  recordId,
  revision,
  fakeMode,
}: {
  initialScenario: Scenario;
  recordId?: string;
  revision?: number;
  fakeMode: boolean;
}) {
  const [draft, setDraft] = useState(initialScenario);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const savingRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const update = (value: Partial<Scenario>) => {
    setDraft((previous) => ({ ...previous, ...value }));
    setDirty(true);
  };
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (errors.length) errorRef.current?.focus();
  }, [errors]);

  async function save(practice: boolean) {
    if (savingRef.current) return;
    const normalized = {
      ...draft,
      title: draft.title.trim(),
      objectives: draft.objectives.map((o) => {
        const scoringRubric = Object.fromEntries(
          Object.entries(o.scoringRubric!).map(([level, rule]) => [
            level,
            {
              description: rule.description.trim(),
              examples: rule.examples.map((e) => e.trim()).filter(Boolean),
            },
          ]),
        ) as NonNullable<typeof o.scoringRubric>;
        return {
          ...o,
          scoringRubric,
          acceptableExamples: scoringRubric.met.examples,
          unacceptableExamples: scoringRubric.not_met.examples,
          exactPhrases:
            o.evaluationType === "exact_phrase"
              ? o.exactPhrases?.map((p) => p.trim()).filter(Boolean)
              : undefined,
        };
      }),
    };
    const parsed = authoredScenarioSchema.safeParse(normalized);
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((issue) => {
          const path =
            issue.path[0] === "objectives" && typeof issue.path[1] === "number"
              ? `Category ${issue.path[1] + 1}`
              : String(issue.path[0] ?? "Scenario");
          return `${path}: ${issue.message}`;
        }),
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setErrors([]);
    try {
      const response = await fetch(
        recordId ? `/api/scenarios/${recordId}` : "/api/scenarios",
        {
          method: recordId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: parsed.data,
            ...(recordId ? { revision } : {}),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not save the scenario.");
      setDirty(false);
      router.push(
        practice
          ? `/?scenario=${data.record.scenario.id}`
          : `/scenarios?saved=${data.record.scenario.id}`,
      );
      router.refresh();
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "Could not connect. Your edits are still here; please retry saving.",
      ]);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="authoring-page">
        <Link
          className="back-link"
          href="/scenarios"
          onClick={(e) => {
            if (dirty && !window.confirm("Leave without saving your changes?"))
              e.preventDefault();
          }}
        >
          ← Back to scenario library
        </Link>
        <div className="page-heading">
          <div>
            <div className="eyebrow">SCENARIO BUILDER</div>
            <h1>
              {recordId
                ? "Refine your scenario."
                : "Create a new practice scenario."}
            </h1>
            <p>Define the conversation, then show what good looks like.</p>
          </div>
          <span className="library-badge">
            {dirty
              ? "Unsaved changes"
              : recordId
                ? `Version ${revision}`
                : "New scenario"}
          </span>
        </div>
        <form
          className="builder-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save(
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "value",
              ) === "practice",
            );
          }}
        >
          {errors.length > 0 && (
            <div
              className="author-error"
              role="alert"
              ref={errorRef}
              tabIndex={-1}
            >
              <strong>Please check your scenario</strong>
              <ul>
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
              {recordId && (
                <p>
                  If another editor saved changes, reload this page after
                  copying any edits you want to keep.
                </p>
              )}
            </div>
          )}
          <fieldset className="builder-fields" disabled={saving}>
            <section className="builder-section">
              <div className="section-heading">
                <span>01</span>
                <div>
                  <h2>Set the scene</h2>
                  <p>Give the learner enough context to begin naturally.</p>
                </div>
              </div>
              <div className="builder-grid">
                <label>
                  Scenario title
                  <input
                    required
                    maxLength={150}
                    value={draft.title}
                    onChange={(e) => update({ title: e.target.value })}
                    placeholder="For example: Supporting an overwhelmed colleague"
                  />
                </label>
                <label>
                  Topic
                  <input
                    required
                    maxLength={100}
                    value={draft.category}
                    onChange={(e) => update({ category: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Scenario description
                <textarea
                  required
                  rows={3}
                  maxLength={2000}
                  value={draft.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="What has happened, and what needs to be addressed?"
                />
              </label>
              <label>
                Learner’s role
                <textarea
                  required
                  rows={2}
                  maxLength={2000}
                  value={draft.learnerRole}
                  onChange={(e) => update({ learnerRole: e.target.value })}
                  placeholder="You are a team lead meeting with a colleague who feels overwhelmed."
                />
              </label>
            </section>
            <section className="builder-section">
              <div className="section-heading">
                <span>02</span>
                <div>
                  <h2>Give Practice Bot a role</h2>
                  <p>
                    The bot’s display name stays Practice Bot. Its role changes
                    with the scenario.
                  </p>
                </div>
              </div>
              <label>
                Practice Bot’s role
                <input
                  required
                  maxLength={300}
                  value={draft.character.role}
                  onChange={(e) =>
                    update({
                      character: { name: "Practice Bot", role: e.target.value },
                    })
                  }
                  placeholder="An overwhelmed colleague who is hesitant to ask for help"
                />
              </label>
              <label>
                Opening message
                <textarea
                  required
                  rows={3}
                  maxLength={2000}
                  value={draft.openingMessage}
                  onChange={(e) => update({ openingMessage: e.target.value })}
                  placeholder="I’m struggling to keep up, but I don’t want to let everyone down."
                />
              </label>
              <label>
                Conversation instructions
                <textarea
                  required
                  rows={4}
                  maxLength={4000}
                  value={draft.conversationInstructions}
                  onChange={(e) =>
                    update({ conversationInstructions: e.target.value })
                  }
                />
              </label>
            </section>
            <section className="builder-section">
              <div className="section-heading">
                <span>03</span>
                <div>
                  <h2>Build the scoring rubric</h2>
                  <p>
                    Describe observable behavior at each level. Include at least
                    one example for every score. Required categories contribute
                    equally to the overall score.
                  </p>
                </div>
              </div>
              <RubricAssistant
                draft={draft}
                onAdd={(objective) => {
                  const existing = draft.objectives.filter(
                    (o) => !isBlankObjective(o),
                  );
                  if (existing.length < 12)
                    update({ objectives: [...existing, objective] });
                }}
              />
              {draft.objectives.map((objective, index) => (
                <RubricEditor
                  key={objective.id}
                  objective={objective}
                  index={index}
                  canRemove={draft.objectives.length > 1}
                  onChange={(value) =>
                    update({
                      objectives: draft.objectives.map((o, i) =>
                        i === index ? value : o,
                      ),
                    })
                  }
                  onRemove={() =>
                    update({
                      objectives: draft.objectives.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                />
              ))}
              <button
                type="button"
                className="secondary"
                disabled={draft.objectives.length >= 12}
                onClick={() =>
                  update({
                    objectives: [
                      ...draft.objectives,
                      emptyObjective(crypto.randomUUID()),
                    ],
                  })
                }
              >
                + Add category
              </button>
              <p className="builder-hint">
                At least one category must be required. Up to 12 categories per
                scenario.
              </p>
            </section>
            <section className="builder-section">
              <div className="section-heading">
                <span>04</span>
                <div>
                  <h2>Set session boundaries</h2>
                  <p>
                    The app controls when the session ends and preserves earned
                    credit when someone stops early.
                  </p>
                </div>
              </div>
              <div className="builder-grid three-columns">
                <label>
                  Maximum learner turns
                  <input
                    type="number"
                    required
                    min={1}
                    max={30}
                    value={draft.maximumTurns}
                    onChange={(e) =>
                      update({ maximumTurns: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Warn after consecutive off-topic turns
                  <input
                    type="number"
                    required
                    min={1}
                    max={9}
                    value={draft.offTopicWarningAt}
                    onChange={(e) =>
                      update({ offTopicWarningAt: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  End after consecutive off-topic turns
                  <input
                    type="number"
                    required
                    min={2}
                    max={10}
                    value={draft.maximumConsecutiveOffTopicTurns}
                    onChange={(e) =>
                      update({
                        maximumConsecutiveOffTopicTurns: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Successful-session message
                <textarea
                  required
                  rows={2}
                  maxLength={2000}
                  value={draft.completionMessage}
                  onChange={(e) =>
                    update({ completionMessage: e.target.value })
                  }
                />
              </label>
              <label>
                Incomplete-session message
                <textarea
                  required
                  rows={2}
                  maxLength={2000}
                  value={draft.incompleteSessionMessage}
                  onChange={(e) =>
                    update({ incompleteSessionMessage: e.target.value })
                  }
                />
              </label>
            </section>
          </fieldset>
          {fakeMode && (
            <div className="author-notice">
              <strong>Offline preview is available.</strong> Custom scenarios
              match the example replies in your rubric, with generic bot
              responses. Connected Practice Bot mode is needed to follow custom
              character instructions and assess varied wording.
            </div>
          )}
          <div className="builder-save">
            <span>
              {draft.objectives.length} categories ·{" "}
              {draft.objectives.filter((o) => o.required).length} required
            </span>
            <button
              className="secondary"
              type="submit"
              disabled={saving}
              value="save"
            >
              {saving ? "Saving…" : "Save scenario"}
            </button>
            <button
              className="primary"
              type="submit"
              disabled={saving}
              value="practice"
            >
              Save & practice →
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
