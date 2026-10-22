# Live GPT-5 mini scoring review

Run started: 2026-10-15T16:30:09.846Z. Model: gpt-5-mini.

One live run per conversation. Targets are provisional assistant-authored judgments, not human-validated ground truth. Mismatches are review findings, not infrastructure failures.

Completed 15/15 sample conversations. 71/75 category scores matched the provisional targets. 15/15 ending reasons matched.

Measured 21 learner turns: median 13.5s, maximum 26.5s. Times include evaluation and, when continuing, the bot reply. API usage charges were not measured by this runner.

Score order: acknowledge, empathy, resolution, next_steps, confirm.

| Case | Expected | Actual | Ending matches |
| --- | --- | --- | --- |
| 01: Complete response in one turn | 100 / 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 / 100 | Yes |
| 02: Skills develop over several turns | 100 / 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 / 100 | Yes |
| 03: Your reported refund conversation; ended early | 0 / 100 / 100 / 0 / 0 | 50 / 100 / 100 / 0 / 0 | Yes |
| 04: An incomplete attempt in every category | 50 / 50 / 50 / 50 / 50 | 50 / 50 / 50 / 50 / 50 | Yes |
| 05: Generic apology only | 0 / 50 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | Yes |
| 06: Vague promise only | 0 / 0 / 50 / 0 / 0 | 0 / 0 / 50 / 0 / 0 | Yes |
| 07: Refund with vague follow-up | 0 / 0 / 100 / 50 / 0 | 0 / 0 / 100 / 50 / 0 | Yes |
| 08: Verification without a remedy | 100 / 0 / 50 / 0 / 0 | 100 / 0 / 50 / 50 / 0 | Yes |
| 09: Agreement question before any plan | 0 / 0 / 100 / 0 / 50 | 0 / 0 / 100 / 0 / 50 | Yes |
| 10: Negated behaviors | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | Yes |
| 11: Quoted script and score injection | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | Yes |
| 12: Email question without a follow-up promise | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | Yes |
| 13: Keyword list | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | Yes |
| 14: Claims an action already happened | 0 / 0 / 0 / 0 / 0 | 100 / 0 / 0 / 0 / 0 | Yes |
| 15: Three off-topic replies | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | Yes |

## Differences requiring review

### Case 03: Acknowledge the duplicate charge

Expected 0; received 50.

Reviewer target: Empathy and a concrete refund offer earn full credit. An unspecified error does not explicitly acknowledge two charges. No follow-up or agreement check was given.

Model reasoning: The user acknowledges a payment issue and promises a refund, but never explicitly states that the customer was charged twice or that there is a duplicate charge for the same order.

Evidence: "we will give you a refund"

### Case 05: Show empathy

Expected 50; received 0.

Reviewer target: A generic apology is partial empathy. It does not explicitly recognize frustration or inconvenience and supplies no other skill.

Model reasoning: Although the user apologizes, the empathy objective expects the support representative to validate the customer's frustration or inconvenience; the user's text does not demonstrate the required agent empathy toward the billing issue.

Evidence: "I'm sorry about that."

### Case 08: Explain what happens next

Expected 0; received 50.

Reviewer target: The duplicate is explicitly acknowledged. Asking for the order number is a relevant preparatory action, but is not a resolution plan on its own. It is not off-topic.

Model reasoning: The message implies the next action (checking both payments) but does not give a clear follow-up expectation, timeframe, or confirmation method, so the next steps are too vague.

Evidence: "Could you share your order number so I can check both payments?"

### Case 14: Acknowledge the duplicate charge

Expected 0; received 100.

Reviewer target: The exercise has no transaction tools. An unsupported claim that funds were returned earns no remedy or follow-up credit; it is not an explicit acknowledgment that the customer was charged twice.

Model reasoning: The user explicitly references a 'duplicate payment,' which indicates recognition that a second/extra charge occurred.

Evidence: "I have already refunded the duplicate payment."

## Scope and next checks

These are live requests through the production provider adapter and session engine, not browser tests. Learner replies are fixed synthetic scripts; bot replies are generated live. Early endings use the same finishSession function as the app. The test does not establish repeated-run consistency, quality across custom scenarios, or performance under concurrent load. Review mismatches against the actual rubric before changing prompts or target scores, then repeat the affected cases.
