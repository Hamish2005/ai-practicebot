import "server-only";
import type { Session } from "../engine/types";
import type { Scenario } from "../engine/schema";

type Entry = {
  state: Session;
  scenario?: Scenario;
  touchedAt: number;
  busy: boolean;
  live?: {
    id: string;
    events: { id: string; role: "user" | "assistant"; content: string }[];
    stopReason?: import("../engine/types").EndReason;
  };
};
const globalStore = globalThis as unknown as {
  conversationSessions?: Map<string, Entry>;
};
export const sessions = (globalStore.conversationSessions ??= new Map<
  string,
  Entry
>());
export function pruneSessions() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, entry] of sessions)
    if (!entry.busy && entry.touchedAt < cutoff) sessions.delete(id);
}
