# Luna scoring reasoning experiment

Tested `reasoning.effort: none` against the concise-output `low` baseline on October 15, 2026. The app remains on **low**. The experimental setting is passed explicitly through the live runner; it does not change the app's configuration.

## Outcome

Both attempts completed cases 01–03, then failed on case 04 (an incomplete attempt in every category) with `SyntaxError: Error reading response: invalid structured output JSON.` This happened in the scoring call; the actor returned a reply successfully. The runner stopped instead of skipping the failure. Cases 05–15 were not tested with reasoning off.

All 15 final category scores across the first three conversations matched their provisional targets in each attempt. That partial agreement is insufficient to establish accuracy or reliability across the full suite. The baseline completed all 15 conversations and matched 75/75 targets.

For the same six completed learner turns, mean user-visible wait was 6.19 seconds in the low baseline, 3.93 seconds in the first no-reasoning attempt, and 6.06 seconds in the second attempt. Failed turns are excluded from those figures. The result does not establish a consistent end-to-end speed gain and must not be compared as a full-suite improvement against the baseline's 4.42-second median.

We have not isolated whether the malformed output originates in model generation, API handling, or SDK parsing. The repeated failure under this setting is sufficient reason not to deploy it, without claiming a general incompatibility between Luna and structured outputs.

## Reproduce and artifacts

Update: the experimental provider parameter and CLI switches were subsequently removed. The commands below describe the historical experiment and are no longer accepted. Use `npm run test:live` to verify the restored low-reasoning configuration. The restoration run completed all 15 conversations without provider errors, matched all ending reasons and 73/75 provisional category targets. All 110 offline tests and the production build passed.

- `npm run test:live -- --reasoning=none` explicitly opts into billed experimental calls.
- `npm run test:live -- --reasoning=low` runs the existing setting.
- Both attempts are preserved locally as `test-results/luna-none-attempt-1.json` and `test-results/luna-none-attempt-2.json`.
- The [low-reasoning baseline](luna-low-reasoning-baseline.md) and [latest live report](live-scoring-review.md) retain the working-setting results and timing details. The failed attempts remain in the JSON artifacts listed above.

All 110 offline tests, type checking, and focused lint checks passed. No scoring criteria, session-ending behavior, or production reasoning defaults were changed. The next investigation should examine the malformed response in an isolated diagnostic before considering this setting again, or optimize the low-reasoning evaluator independently.
