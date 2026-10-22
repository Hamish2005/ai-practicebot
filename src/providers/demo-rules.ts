/** Limited offline rules, not a replacement for model-backed semantic evaluation. */
export const injection =
  /ignore.*(rules|instructions)|mark.*objective|hidden prompt|system prompt/i;
const patterns: Record<string, RegExp[]> = {
  acknowledge: [
    /\byou (?:were|have been|got) charged (?:twice|two times)\b/i,
    /\bwe (?:have )?charged you (?:twice|two times)\b/i,
    /\b(?:i|we) (?:can see|see|understand|recognize|acknowledge).{0,70}\b(?:duplicate|double|extra|second) (?:charge|payment)\b/i,
  ],
  empathy: [
    /\b(?:that|this|it) (?:is|sounds|must be) (?:really |very |so )?(?:frustrating|upsetting|stressful)\b/i,
    /\b(?:i|we) understand (?:how |your |the ).{0,35}\b(?:frustrat\w*|upsetting|stressful|inconvenience)\b/i,
    /\b(?:i am|i'm|we are|we're|i|we) (?:really |very )?(?:sorry|apologi[sz]e).{0,35}\b(?:inconvenience|frustration|trouble|extra charge|duplicate charge)\b/i,
  ],
  resolution: [
    /\b(?:i|we)(?:'ll| will| can| am going to| are going to)\b.{0,65}\b(?:refund|money back|reverse (?:the |that )?(?:extra|duplicate|second) charge)\b/i,
  ],
  next_steps: [
    /\b(?:you (?:will|can expect to)|you'll|i will|i'll|we will|we'll)\b.{0,65}\b(?:email|confirmation)\b/i,
    /\b(?:i|we)(?:'ll| will) (?:update|contact) you\b.{0,25}\b(?:today|tomorrow|by email|within \d+ hours?)\b/i,
    /\b(?:refund|money)\b.{0,40}\b(?:arrive|appear|take|reach|back)\b.{0,30}\b\d+(?:\s*[-–]\s*\d+)?\s*(?:business |working )?days?\b/i,
  ],
  confirm: [
    /\bdoes (?:that|this|(?:the|that|this) (?:refund )?plan) (?:work|sound (?:okay|ok|good|acceptable)) (?:for|to) you\b/i,
    /\b(?:is (?:that|this) (?:okay|ok|acceptable) (?:with|to) you|are you (?:happy|comfortable|okay|ok) with (?:that|this|the plan))\b/i,
  ],
};
const partialPatterns: Record<string, RegExp[]> = {
  acknowledge: [
    /\b(?:i|we) (?:see|understand|recognize|acknowledge).{0,60}\b(?:payment problem|billing (?:problem|concern|issue)|problem with your payment)\b/i,
  ],
  empathy: [
    /\b(?:i(?:'m| am)|we(?:'re| are)) (?:really |very )?sorry\b/i,
    /\b(?:i|we) apologi[sz]e\b/i,
  ],
  resolution: [
    /\b(?:i|we)(?:'ll| will| can) (?:fix|sort|look into|investigate|check)\b/i,
    /\b(?:could|can|please).{0,30}\b(?:share|provide|send).{0,25}\border number\b.{0,35}\b(?:check|verify|investigate)\b/i,
  ],
  next_steps: [
    /\b(?:you(?:'ll| will) hear (?:back|from us)|(?:i|we)(?:'ll| will) (?:update|contact) you)\b/i,
  ],
  confirm: [/^(?:okay|ok|all right|sound good)\?$/i],
};
export function supportedClauses(words: string[]): string[] {
  return words
    .filter((w) => !injection.test(w))
    .flatMap((w) => w.split(/(?<=[.!?;,])\s+/))
    .map((w) => w.trim())
    .filter(
      (w) =>
        w &&
        !/\b(?:not|never|don't|won't|can't|cannot|isn't|wouldn't|shouldn't|say|pretend|example|quote)\b|["“”]/i.test(
          w,
        ),
    );
}
export function demoObservation(
  id: string,
  clauses: string[],
): { status: "not_met" | "partial" | "met"; evidence: string | null } {
  let partial: string | null = null;
  let hasPlan = false;
  for (const clause of clauses) {
    // Establish context in transcript order; later plans cannot upgrade earlier questions.
    if (patterns.resolution.some((pattern) => pattern.test(clause)))
      hasPlan = true;
    const fullMatch = patterns[id]?.some((pattern) => pattern.test(clause));
    if (fullMatch && (id !== "confirm" || hasPlan))
      return { status: "met", evidence: clause };
    if (
      !partial &&
      (fullMatch ||
        partialPatterns[id]?.some((pattern) => pattern.test(clause)))
    )
      partial = clause;
  }
  return partial
    ? { status: "partial", evidence: partial }
    : { status: "not_met", evidence: null };
}
