import { it, vi, expect } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
vi.mock("server-only", () => ({}));
import { createOpenAIProvider } from "../src/providers/openai";
import { startSession, submitTurn, finishSession } from "../src/engine/session";
import { duplicateCharge } from "../src/scenarios/duplicate-charge";
import { categoryIds, conversations } from "../benchmarks/duplicate-charge";
import type { Provider } from "../src/engine/types";

// Never calls the API during npm test. npm run test:live explicitly opts in.
it.skipIf(process.env.RUN_LIVE_OPENAI !== "1")(
  "live configured-model conversation and rubric review",
  async () => {
    const model = process.env.OPENAI_MODEL ?? "gpt-6-luna";
    const provider = createOpenAIProvider(process.env.OPENAI_API_KEY!, model);
    const results: Record<string, unknown>[] = [];
    const startedAt = new Date().toISOString();
    const report = {
      model,
      scoringReasoning: model === "gpt-6-luna" ? "low" : "model default",
      parallelReplies: provider.parallelReplies === true,
      conciseOutputs: true,
      startedAt,
      note: "One live run per conversation. Targets are provisional assistant-authored judgments, not human-validated ground truth. Mismatches are review findings, not infrastructure failures.",
      categoryIds,
      results,
    };
    await mkdir("test-results", { recursive: true });
    for (const sample of conversations) {
      const started = Date.now();
      let state = startSession(duplicateCharge, `live-${sample.id}`, started);
      const turnDurationsMs: number[] = [];
      const callTimings: {
        turn: number;
        operation: string;
        elapsedMs: number;
        outcome: string;
        outputCharacters?: number;
      }[] = [];
      try {
        for (const message of sample.messages) {
          if (state.endedAt !== null) break;
          const turnStart = Date.now();
          const turn = state.turns + 1;
          const pending: Promise<unknown>[] = [];
          function timed<T>(
            operation: string,
            work: () => Promise<T>,
            signal?: AbortSignal,
          ): Promise<T> {
            const start = performance.now();
            const task = Promise.resolve()
              .then(work)
              .then(
                (value) => {
                  callTimings.push({
                    turn,
                    operation,
                    elapsedMs: Math.round(performance.now() - start),
                    outcome: "completed",
                    outputCharacters: (typeof value === "string"
                      ? value
                      : JSON.stringify(value)
                    ).length,
                  });
                  return value;
                },
                (error) => {
                  callTimings.push({
                    turn,
                    operation,
                    elapsedMs: Math.round(performance.now() - start),
                    outcome: signal?.aborted ? "cancelled" : "failed",
                  });
                  throw error;
                },
              );
            pending.push(task);
            return task;
          }
          const measured: Provider = {
            ...provider,
            evaluator: {
              evaluate: (input) =>
                timed("scoring", () => provider.evaluator.evaluate(input)),
            },
            actor: {
              generateReply: (input) =>
                timed(
                  "reply",
                  () => provider.actor.generateReply(input),
                  input.signal,
                ),
            },
          };
          try {
            state = await submitTurn(duplicateCharge, state, message, measured);
            // Capture user-visible latency before waiting for a cancelled background call.
            turnDurationsMs.push(Date.now() - turnStart);
          } finally {
            await Promise.allSettled(pending);
          }
        }
        if (state.endedAt === null)
          state = finishSession(
            duplicateCharge,
            state,
            "complete_user",
            Date.now(),
          );
        const actual = categoryIds.map(
          (id) =>
            state.feedback!.assessments.find((a) => a.objectiveId === id)!
              .score,
        );
        const mismatches = categoryIds.filter(
          (_, i) => actual[i] !== sample.expected[i],
        );
        results.push({
          id: sample.id,
          title: sample.title,
          expected: sample.expected,
          actual,
          mismatches,
          expectedEndReason: sample.endReason,
          actualEndReason: state.feedback!.reason,
          judgment: sample.judgment,
          feedback: state.feedback,
          transcript: state.transcript,
          turnDurationsMs,
          callTimings,
          elapsedMs: Date.now() - started,
        });
        console.log(
          `Case ${sample.id}: [${actual.join(", ")}] — ${mismatches.length} category differences; ${state.feedback!.reason}; ${Date.now() - started}ms`,
        );
      } catch (error) {
        // Do not serialize SDK errors: these can contain request/credential details.
        const failure = error as {
          status?: number;
          code?: string;
          name?: string;
          message?: string;
        };
        const safeMessage = (failure.message ?? "Unknown error")
          .replaceAll(process.env.OPENAI_API_KEY!, "[redacted]")
          .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
          .slice(0, 600);
        console.log(`Live test error: ${safeMessage}`);
        results.push({
          id: sample.id,
          failed: true,
          status: failure.status,
          code: failure.code,
          errorType: failure.name,
          message: safeMessage,
          callTimings,
        });
        await writeFile(
          "test-results/live-openai.json",
          JSON.stringify(report, null, 2),
        );
        throw new Error(
          `Live case ${sample.id} failed (${failure.status ?? "no HTTP status"}, ${failure.code ?? failure.name ?? "unknown"}). See the saved report; no later cases were sent.`,
        );
      }
      await writeFile(
        "test-results/live-openai.json",
        JSON.stringify(report, null, 2),
      );
    }
    expect(results).toHaveLength(conversations.length);
  },
  900_000,
);
