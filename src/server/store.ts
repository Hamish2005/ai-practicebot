import "server-only";
import {
  createSharedSessionStorage,
  expiresAt,
  type SessionEntry,
} from "./session-storage";
export { SessionStorageError } from "./session-storage";
const globalStore = globalThis as unknown as {
  conversationSessions?: Map<string, SessionEntry>;
};
export const sessions = (globalStore.conversationSessions ??= new Map<
  string,
  SessionEntry
>());
export const sharedSessionsEnabled = () =>
  process.env.NETLIFY === "true" ||
  process.env.SESSION_STORAGE === "netlify" ||
  Boolean(globalThis.netlifyBlobsContext) ||
  Boolean(process.env.NETLIFY_BLOBS_CONTEXT);
let shared: ReturnType<typeof createSharedSessionStorage> | undefined;
const remote = () => (shared ??= createSharedSessionStorage());
export function pruneSessions() {
  for (const [id, entry] of sessions)
    if (!entry.busy && expiresAt(entry) <= Date.now()) sessions.delete(id);
}
export async function getSession(id: string) {
  if (sharedSessionsEnabled()) return remote().get(id);
  pruneSessions();
  return sessions.get(id);
}
export async function createSession(entry: SessionEntry) {
  if (sharedSessionsEnabled()) return remote().create(entry);
  sessions.set(entry.state.id, entry);
}
export async function lockSession(entry: SessionEntry) {
  if (sharedSessionsEnabled()) return remote().lock(entry);
  if (entry.busy) return false;
  entry.busy = true;
  return true;
}
export async function releaseSession(entry: SessionEntry) {
  if (sharedSessionsEnabled()) return remote().release(entry);
  entry.busy = false;
}
export async function deleteSession(entry: SessionEntry) {
  if (sharedSessionsEnabled()) return remote().remove(entry);
  sessions.delete(entry.state.id);
}
