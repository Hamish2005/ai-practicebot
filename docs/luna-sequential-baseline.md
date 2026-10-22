# Live gpt-6-luna scoring review

Run started: 2026-10-15T16:49:34.876Z. Model: gpt-6-luna.

One live run per conversation. Targets are provisional assistant-authored judgments, not human-validated ground truth. Mismatches are review findings, not infrastructure failures.

Completed 15/15 sample conversations. 73/75 category scores matched the provisional targets. 15/15 ending reasons matched.

Measured 21 learner turns: median 5.4s, maximum 13.0s. Times include evaluation and, when continuing, the bot reply. API usage charges were not measured by this runner.

Score order: acknowledge, empathy, resolution, next_steps, confirm.

| Case                                               | Expected                    | Actual                      | Ending matches |
| -------------------------------------------------- | --------------------------- | --------------------------- | -------------- |
| 01: Complete response in one turn                  | 100 / 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 / 100 | Yes            |
| 02: Skills develop over several turns              | 100 / 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 / 100 | Yes            |
| 03: Your reported refund conversation; ended early | 0 / 100 / 100 / 0 / 0       | 50 / 100 / 100 / 0 / 0      | Yes            |
| 04: An incomplete attempt in every category        | 50 / 50 / 50 / 50 / 50      | 50 / 50 / 50 / 50 / 50      | Yes            |
| 05: Generic apology only                           | 0 / 50 / 0 / 0 / 0          | 0 / 50 / 0 / 0 / 0          | Yes            |
| 06: Vague promise only                             | 0 / 0 / 50 / 0 / 0          | 0 / 0 / 50 / 0 / 0          | Yes            |
| 07: Refund with vague follow-up                    | 0 / 0 / 100 / 50 / 0        | 0 / 0 / 100 / 50 / 0        | Yes            |
| 08: Verification without a remedy                  | 100 / 0 / 50 / 0 / 0        | 100 / 0 / 50 / 0 / 0        | Yes            |
| 09: Agreement question before any plan             | 0 / 0 / 100 / 0 / 50        | 100 / 0 / 100 / 0 / 50      | Yes            |
| 10: Negated behaviors                              | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |
| 11: Quoted script and score injection              | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |
| 12: Email question without a follow-up promise     | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |
| 13: Keyword list                                   | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |
| 14: Claims an action already happened              | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |
| 15: Three off-topic replies                        | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |

## Differences requiring review

### Case 03: Acknowledge the duplicate charge

Expected 0; received 50.

Reviewer target: Empathy and a concrete refund offer earn full credit. An unspecified error does not explicitly acknowledge two charges. No follow-up or agreement check was given.

Model reasoning: Recognizes a billing error in context, but does not explicitly identify two charges for the same order.

Evidence: "There must have been an error on our side"

### Case 09: Acknowledge the duplicate charge

Expected 0; received 100.

Reviewer target: The later refund offer earns resolution credit. The earlier agreement question has no established plan and remains partial; later context must not retroactively make it full credit.

Model reasoning: Offering a refund for the duplicate charge explicitly recognizes the extra charge.

Evidence: "I can refund the duplicate charge."

## Scope and next checks

These are live requests through the production provider adapter and session engine, not browser tests. Learner replies are fixed synthetic scripts; bot replies are generated live. Early endings use the same finishSession function as the app. The test does not establish repeated-run consistency, quality across custom scenarios, or performance under concurrent load. Review mismatches against the actual rubric before changing prompts or target scores, then repeat the affected cases.
