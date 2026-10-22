import { duplicateCharge } from "../src/scenarios/duplicate-charge";
import { fakeProvider } from "../src/providers/fake";
import { startSession, submitTurn, finishSession } from "../src/engine/session";
import { categoryIds, conversations } from "./duplicate-charge";

export async function runBenchmark() {
  return Promise.all(
    conversations.map(async (sample) => {
      let state = startSession(duplicateCharge, `benchmark-${sample.id}`, 0);
      for (const message of sample.messages) {
        if (state.endedAt !== null) break;
        state = await submitTurn(
          duplicateCharge,
          state,
          message,
          fakeProvider,
          () => 1000,
        );
      }
      if (state.endedAt === null)
        state = finishSession(duplicateCharge, state, "complete_user", 1000);
      const feedback = state.feedback!;
      const actual = categoryIds.map(
        (id) => feedback.assessments.find((a) => a.objectiveId === id)!.score,
      );
      return {
        id: sample.id,
        actual,
        overall: feedback.overallScore,
        endReason: feedback.reason,
        feedback,
        transcript: state.transcript,
        turns: state.turns,
      };
    }),
  );
}
