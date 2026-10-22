# Parallel Luna speed comparison

Compared the preserved sequential Luna run with one parallel run of the same 15 synthetic conversations (21 learner turns each). Both use GPT-6 Luna with low reasoning for evaluation and no reasoning for replies. The parallel actor receives prior-turn scores and the full current transcript. The controller still gates publication; no streaming is enabled.

| Measure                                     | Sequential | Parallel |
| ------------------------------------------- | ---------- | -------- |
| Median, all turns                           | 5.377s     | 4.677s   |
| Mean, all turns                             | 5.703s     | 4.893s   |
| Maximum                                     | 12.998s    | 10.255s  |
| Median, continuing turns only               | 5.743s     | 4.677s   |
| Category agreement with provisional targets | 73/75      | 73/75    |
| Expected ending reasons                     | 15/15      | 15/15    |

The observed median improvement is 13.0% across all turns and 18.6% for continuing turns. This is one before/after comparison, not a controlled repeated latency study. API load, caching, generated text and model variability can affect results. No per-call token costs were captured. Speculative replies on terminal or failed turns may still be billed even when cancelled or discarded.

Eight new engine tests cover concurrent startup, withholding drafts, cancellation for every automatic completion reason, evaluator failure, and actor failure on continuing versus terminal turns. All 110 offline tests and the production build pass. This remains text-provider timing, not microphone-to-first-audio latency.

See [sequential baseline](luna-sequential-baseline.md) and [parallel baseline](luna-parallel-baseline.md). The remaining two category mismatches are acknowledgment judgments; matching aggregate counts do not establish repeated-run consistency.
