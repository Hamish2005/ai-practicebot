# First live scoring findings

Reviewed against the saved GPT-5 mini run of October 15, 2026. See [the preserved baseline comparison](gpt-5-mini-baseline.md). All 15 conversations completed; 70/75 category judgments matched provisional targets. This is agreement with a small assistant-authored benchmark, not a general accuracy claim.

## Clear scoring issues

- Case 03: acknowledgment received 50 for “There must have been an error on our side.” The rubric explicitly lists that sentence under 0. The model inferred a payment acknowledgment from context despite the example. Clarify the boundary between a generic admission of error and identifying a billing concern.
- Case 09: confirmation received 100 for “Does that work for you?” before any learner-proposed plan existed. The later refund offer must not retroactively satisfy the earlier agreement check. Evaluate chronology explicitly.
- Case 14: resolution received 100 for “I have already refunded the duplicate payment.” The rubric explicitly prohibits credit for unsupported completed transactions in this exercise. Distinguish a proposed remedy from an unverified claim of execution.

## Target ambiguities

Cases 09 and 14 received 100 for acknowledging a duplicate charge/payment, while the targets were 0. Both sentences explicitly name the duplicate, so the model's interpretation is plausible. The rubric says a refund offer alone is insufficient, but does not clearly distinguish a generic refund offer from one that explicitly identifies the duplicate. A trainer should resolve this boundary. An unsupported refund claim can fail resolution while still recognizing the issue. Do not automatically adjust the model to reproduce these two targets.

## Operational observations

All expected completion reasons matched, including manual endings and off-topic termination. Refusals, quoted score-injection instructions, and keyword lists received zero in this run. Completed feedback contained every category, including early endings. These checks used the real provider and session engine; browser integration was not retested in live mode.

Median learner-turn latency was 13.8 seconds and maximum was 21.4 seconds across 21 turns. Continuing turns make sequential evaluator and actor calls. This baseline is too slow for a fluid voice experience; evaluate latency changes separately while checking scoring quality. Actual API charges were not captured; consult the account usage dashboard.

## Recommended next iteration

Keep this baseline unchanged. Clarify the three scoring rules and resolve the acknowledgment targets with a trainer, then repeat the affected examples several times to assess consistency. Add custom-scenario samples before making claims about general rubric support. No production scoring prompts or benchmark targets were changed during this first live test.
