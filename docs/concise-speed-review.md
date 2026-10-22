# Concise-output speed comparison

The October 15, 2026 run tested shorter scoring explanations and bot replies using the same GPT-6 Luna settings, parallel execution, 15 synthetic conversations, and 21 learner turns as the preceding baseline. Scoring and reply calls now have separate measurements in the live test report. Measurements include SDK/network overhead and retries; they do not isolate model compute time.

| Measure                                     | Parallel baseline | Concise outputs |
| ------------------------------------------- | ----------------- | --------------- |
| Median user-visible wait                    | 4.677s            | 4.422s          |
| Mean user-visible wait                      | 4.893s            | 5.006s          |
| Maximum wait                                | 10.255s           | 11.787s         |
| Category agreement with provisional targets | 73/75             | 75/75           |
| Expected ending reasons                     | 15/15             | 15/15           |

The median improved by 5.5%, but the mean and maximum worsened. One run per configuration does not establish a reliable overall latency improvement. Model output variability, cache state, and service load can affect these numbers. Agreement with provisional assistant-authored targets is not proof of general scoring accuracy; the existing acknowledgment ambiguities still need trainer review.

## What is causing the wait?

Across 21 calls of each kind, scoring had a median of 4.422s; reply generation had a median of 1.462s and maximum of 2.588s. The calls run concurrently, so their durations must not be added.

The slowest turn was case 02, turn 2: scoring took 11.787s while its reply was ready in 1.689s. The controller correctly withheld that reply until evaluation finished. A completed speculative reply does not necessarily get published: terminal turns still discard it.

## Changes and checks

- Evaluator instructions request one sentence of at most 20 words per explanation, preserving all category scores and supporting quotes.
- Actor instructions request 1–2 short sentences, at most 45 words, and no more than one question. Published replies in this run were at most 37 words and one question.
- These are prompt instructions, not output truncation: replies and structured assessments are not cut off mid-sentence or mid-JSON.
- The live runner records each scoring/reply duration, completion/cancellation/failure outcome, and output character count. No keys are recorded. Timing collection is test instrumentation, not production request logging.
- All 110 offline tests, type checking, and focused lint checks passed. All 15 live conversations completed. The production stopping rules and evidence validation are unchanged.

The next meaningful latency experiment would target the evaluator, such as comparing low versus no reasoning on the same scoring cases. Publishing replies before scoring completes would require a separate session-control design decision; it was not enabled here.

See [parallel baseline](luna-parallel-baseline.md) and [preserved low-reasoning results with per-turn timings](luna-low-reasoning-baseline.md).
