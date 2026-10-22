import type { Assessment, EvaluationResult, Scenario } from "./schema";

export type Decision =
  | "continue"
  | "warn_off_topic"
  | "complete_success"
  | "complete_turn_limit"
  | "complete_off_topic"
  | "complete_safety";
export type EndReason =
  Exclude<Decision, "continue" | "warn_off_topic"> | "complete_user";
export type Message = { role: "user" | "assistant"; content: string };
export type Feedback = {
  successful: boolean;
  reason: EndReason;
  summary: string;
  overallScore: number;
  assessedTurns: number;
  assessments: (Assessment & {
    title: string;
    score: number;
    required: boolean;
  })[];
  suggestions: string[];
};
export type Session = {
  id: string;
  scenarioId: string;
  startedAt: number;
  endedAt: number | null;
  transcript: Message[];
  turns: number;
  objectives: Assessment[];
  consecutiveOffTopic: number;
  warningIssued: boolean;
  decision: Decision | "complete_user";
  feedback: Feedback | null;
  revision: number;
};
export type EvaluationInput = { scenario: Scenario; transcript: Message[] };
export type ActorInput = EvaluationInput & {
  objectives: Assessment[];
  signal?: AbortSignal;
};
export interface ConversationActor {
  generateReply(input: ActorInput): Promise<string>;
}
export interface ObjectiveEvaluator {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}
export type Provider = {
  /** Speculate using prior scores; the controller still gates publication. */
  parallelReplies?: boolean;
  actor: ConversationActor;
  evaluator: ObjectiveEvaluator;
};
