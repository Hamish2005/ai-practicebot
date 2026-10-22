import type { Feedback } from "../engine/types";
import { endLabels } from "../engine/feedback";

export function FeedbackPanel({ feedback }: { feedback: Feedback }) {
  return (
    <section className="feedback" aria-labelledby="feedback-title">
      <span className="eyebrow">YOUR SESSION REVIEW</span>
      <h2 id="feedback-title">
        {feedback.successful
          ? "A conversation well handled."
          : "Every conversation is practice."}
      </h2>
      <div className={`result ${feedback.successful ? "success" : ""}`}>
        {feedback.successful ? "Successful" : "Incomplete"} ·{" "}
        {endLabels[feedback.reason]}
      </div>
      <p>{feedback.summary}</p>
      <section className="scorecard" aria-labelledby="scorecard-title">
        <div className="scorecard-heading">
          <div>
            <h3 id="scorecard-title">Your category scores</h3>
            <p>
              Based on {feedback.assessedTurns} submitted{" "}
              {feedback.assessedTurns === 1 ? "reply" : "replies"}
            </p>
          </div>
          <div
            className="overall-score"
            aria-label={`Overall score: ${feedback.overallScore} out of 100`}
          >
            <strong>{feedback.overallScore}</strong>
            <span>/ 100 overall</span>
          </div>
        </div>
        <ul className="category-scores">
          {feedback.assessments.map((a) => (
            <li key={a.objectiveId}>
              <div className="category-score-label">
                <span>
                  {a.title}
                  {!a.required && <small> · Optional</small>}
                </span>
                <strong>
                  {a.score}
                  <span> / 100</span>
                </strong>
              </div>
              <div className="score-track" aria-hidden="true">
                <div style={{ width: `${a.score}%` }} />
              </div>
              <span className="score-status">
                {a.status === "met"
                  ? "Demonstrated"
                  : a.status === "partial"
                    ? "Partially demonstrated"
                    : "Not yet demonstrated"}
              </span>
            </li>
          ))}
        </ul>
        <p className="scoring-note">
          100 = demonstrated · 50 = partial · 0 = not yet demonstrated. The
          overall score is the average of required categories. Ending early does
          not reduce earned credit. Unsent drafts are not assessed.
        </p>
      </section>
      {(["met", "partial", "not_met"] as const).map((status) => (
        <div key={status} className="assessment-group">
          <h3>
            {status === "met"
              ? "What you did well"
              : status === "partial"
                ? "Partially demonstrated"
                : "Not yet demonstrated"}
          </h3>
          {feedback.assessments.filter((a) => a.status === status).length ===
          0 ? (
            <p className="muted">No objectives in this category.</p>
          ) : (
            feedback.assessments
              .filter((a) => a.status === status)
              .map((a) => (
                <article className="assessment" key={a.objectiveId}>
                  <strong>
                    {a.title}{" "}
                    <span className="assessment-score">{a.score}/100</span>
                  </strong>
                  <p>{a.reasoning}</p>
                  {a.evidence ? (
                    <blockquote>“{a.evidence}”</blockquote>
                  ) : (
                    <span className="muted">
                      No supporting transcript evidence.
                    </span>
                  )}
                </article>
              ))
          )}
        </div>
      ))}
      <div className="next-practice">
        <h3>For your next conversation</h3>
        <ul>
          {feedback.suggestions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
