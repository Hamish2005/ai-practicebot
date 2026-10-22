# Live gpt-6-luna scoring review

Run started: 2026-10-15T17:09:33.207Z. Model: gpt-6-luna.
Reply generation: parallel with evaluation; controller gates publication.

One live run per conversation. Targets are provisional assistant-authored judgments, not human-validated ground truth. Mismatches are review findings, not infrastructure failures.

Completed 15/15 sample conversations. 75/75 category scores matched the provisional targets. 15/15 ending reasons matched.

Measured 21 learner turns: median 4.4s, maximum 11.8s. Times include evaluation and, when continuing, the bot reply. API usage charges were not measured by this runner.

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
| 09: Agreement question before any plan             | 0 / 0 / 100 / 0 / 50        | 0 / 0 / 100 / 0 / 50        | Yes            |
| 10: Negated behaviors                              | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |
| 11: Quoted script and score injection              | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |
| 12: Email question without a follow-up promise     | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |
| 13: Keyword list                                   | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |
| 14: Claims an action already happened              | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |
| 15: Three off-topic replies                        | 0 / 0 / 0 / 0 / 0           | 0 / 0 / 0 / 0 / 0           | Yes            |

## Individual call timings

Elapsed times include SDK/network overhead and any retries. Calls overlap, so these durations must not be added. Cancelled drafts are excluded from completed-call medians.

| Call    | Completed | Median | Maximum | Cancelled |
| ------- | --------- | ------ | ------- | --------- |
| scoring | 21        | 4.42s  | 11.79s  | 0         |
| reply   | 21        | 1.46s  | 2.59s   | 0         |

### Each learner turn

| Case / turn | Visible wait | Scoring | Reply | Reply outcome |
| ----------- | ------------ | ------- | ----- | ------------- |
| 01 / 1      | 4.22s        | 4.22s   | 2.59s | completed     |
| 02 / 1      | 4.46s        | 4.46s   | 2.56s | completed     |
| 02 / 2      | 11.79s       | 11.79s  | 1.69s | completed     |
| 02 / 3      | 5.01s        | 5.01s   | 1.38s | completed     |
| 03 / 1      | 4.68s        | 4.68s   | 1.50s | completed     |
| 03 / 2      | 6.99s        | 6.99s   | 1.19s | completed     |
| 04 / 1      | 4.22s        | 4.22s   | 1.65s | completed     |
| 05 / 1      | 3.95s        | 3.95s   | 1.80s | completed     |
| 06 / 1      | 4.30s        | 4.30s   | 1.91s | completed     |
| 07 / 1      | 4.10s        | 4.10s   | 1.75s | completed     |
| 08 / 1      | 3.83s        | 3.83s   | 1.43s | completed     |
| 09 / 1      | 4.46s        | 4.46s   | 1.37s | completed     |
| 09 / 2      | 4.42s        | 4.42s   | 1.30s | completed     |
| 10 / 1      | 10.17s       | 10.17s  | 2.07s | completed     |
| 11 / 1      | 3.09s        | 3.09s   | 1.48s | completed     |
| 12 / 1      | 3.07s        | 3.07s   | 1.45s | completed     |
| 13 / 1      | 6.63s        | 6.63s   | 1.34s | completed     |
| 14 / 1      | 2.99s        | 2.99s   | 1.46s | completed     |
| 15 / 1      | 4.44s        | 4.44s   | 1.35s | completed     |
| 15 / 2      | 4.54s        | 4.54s   | 1.37s | completed     |
| 15 / 3      | 3.77s        | 3.77s   | 1.38s | completed     |

## Differences requiring review

## Scope and next checks

These are live requests through the production provider adapter and session engine, not browser tests. Learner replies are fixed synthetic scripts; bot replies are generated live. Early endings use the same finishSession function as the app. The test does not establish repeated-run consistency, quality across custom scenarios, or performance under concurrent load. Review mismatches against the actual rubric before changing prompts or target scores, then repeat the affected cases.
