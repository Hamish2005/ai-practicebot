# Live gpt-6-luna scoring review

Run started: 2026-10-15T17:21:31.619Z. Model: gpt-6-luna.
Scoring reasoning: low.
Reply generation: parallel with evaluation; controller gates publication.

One live run per conversation. Targets are provisional assistant-authored judgments, not human-validated ground truth. Mismatches are review findings, not infrastructure failures.

Completed 15/15 sample conversations. 73/75 category scores matched the provisional targets. 15/15 ending reasons matched.

Measured 21 learner turns: median 4.9s, maximum 12.3s. Times include evaluation and, when continuing, the bot reply. API usage charges were not measured by this runner.

Score order: acknowledge, empathy, resolution, next_steps, confirm.

| Case                                               | Expected                    | Actual                      | Ending matches |
| -------------------------------------------------- | --------------------------- | --------------------------- | -------------- |
| 01: Complete response in one turn                  | 100 / 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 / 100 | Yes            |
| 02: Skills develop over several turns              | 100 / 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 / 100 | Yes            |
| 03: Your reported refund conversation; ended early | 0 / 100 / 100 / 0 / 0       | 0 / 100 / 100 / 0 / 0       | Yes            |
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
| 14: Claims an action already happened              | 0 / 0 / 0 / 0 / 0           | 100 / 0 / 0 / 0 / 0         | Yes            |
| 15: Three off-topic replies                        | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |

## Individual call timings

Elapsed times include SDK/network overhead and any retries. Calls overlap, so these durations must not be added. Cancelled drafts are excluded from completed-call medians.

| Call    | Completed | Median | Maximum | Cancelled |
| ------- | --------- | ------ | ------- | --------- |
| scoring | 21        | 4.83s  | 12.32s  | 0         |
| reply   | 21        | 1.52s  | 8.96s   | 0         |

### Each learner turn

| Case / turn | Visible wait | Scoring | Reply | Reply outcome |
| ----------- | ------------ | ------- | ----- | ------------- |
| 01 / 1      | 5.38s        | 5.37s   | 2.17s | completed     |
| 02 / 1      | 4.75s        | 4.75s   | 2.44s | completed     |
| 02 / 2      | 4.76s        | 4.76s   | 1.72s | completed     |
| 02 / 3      | 3.94s        | 3.94s   | 1.39s | completed     |
| 03 / 1      | 4.15s        | 4.15s   | 1.07s | completed     |
| 03 / 2      | 5.99s        | 5.99s   | 1.35s | completed     |
| 04 / 1      | 3.89s        | 3.89s   | 1.52s | completed     |
| 05 / 1      | 4.93s        | 4.93s   | 1.30s | completed     |
| 06 / 1      | 4.38s        | 4.38s   | 1.39s | completed     |
| 07 / 1      | 4.60s        | 4.60s   | 1.71s | completed     |
| 08 / 1      | 4.90s        | 4.90s   | 1.42s | completed     |
| 09 / 1      | 4.20s        | 4.20s   | 1.42s | completed     |
| 09 / 2      | 4.97s        | 4.97s   | 2.21s | completed     |
| 10 / 1      | 8.96s        | 4.83s   | 8.96s | completed     |
| 11 / 1      | 5.17s        | 5.17s   | 1.52s | completed     |
| 12 / 1      | 5.41s        | 5.41s   | 1.26s | completed     |
| 13 / 1      | 5.90s        | 5.90s   | 1.31s | completed     |
| 14 / 1      | 5.48s        | 5.48s   | 2.59s | completed     |
| 15 / 1      | 3.74s        | 3.74s   | 1.53s | completed     |
| 15 / 2      | 12.32s       | 12.32s  | 1.24s | completed     |
| 15 / 3      | 4.76s        | 4.76s   | 1.66s | completed     |

## Differences requiring review

### Case 09: Acknowledge the duplicate charge

Expected 0; received 100.

Reviewer target: The later refund offer earns resolution credit. The earlier agreement question has no established plan and remains partial; later context must not retroactively make it full credit.

Model reasoning: Offering a refund specifically for the duplicate charge recognizes the extra payment.

Evidence: "I can refund the duplicate charge."

### Case 14: Acknowledge the duplicate charge

Expected 0; received 100.

Reviewer target: The exercise has no transaction tools. An unsupported claim that funds were returned earns no remedy or follow-up credit; it is not an explicit acknowledgment that the customer was charged twice.

Model reasoning: The response explicitly identifies a duplicate payment on the order.

Evidence: "I have already refunded the duplicate payment."

## Scope and next checks

These are live requests through the production provider adapter and session engine, not browser tests. Learner replies are fixed synthetic scripts; bot replies are generated live. Early endings use the same finishSession function as the app. The test does not establish repeated-run consistency, quality across custom scenarios, or performance under concurrent load. Review mismatches against the actual rubric before changing prompts or target scores, then repeat the affected cases.
