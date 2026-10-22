import { getStore } from "@netlify/blobs";
import { blobOperation } from "./blob-operation";
import type { Session } from "../engine/types";
import type { Scenario } from "../engine/schema";

export type SessionEntry = {
  state: Session;
  scenario?: Scenario;
  touchedAt: number;
  busy: boolean;
  leaseUntil?: number;
  live?: {
    id: string;
    events: { id: string; role: "user" | "assistant"; content: string }[];
    stopReason?: import("../engine/types").EndReason;
  };
};
export const SESSION_TTL = 2 * 60 * 60 * 1000;
export const COMPLETED_TTL = 15 * 60 * 1000;
export const LEASE_TTL = 3 * 60 * 1000;
export const sessionStoreName = "practice-temporary-sessions";
export const expiresAt = (entry: SessionEntry) =>
  entry.state.endedAt === null
    ? entry.touchedAt + SESSION_TTL
    : entry.state.endedAt + COMPLETED_TTL;

// Also used by the scheduled function, outside Next.js's server-only boundary.
export function temporaryStore() {
  return getStore({ name: sessionStoreName, consistency: "strong" });
}
export class SessionStorageError extends Error {}

export function createSharedSessionStorage(
  store?: ReturnType<typeof temporaryStore>,
) {
  const run = <T>(
    operation: (client: ReturnType<typeof temporaryStore>) => Promise<T>,
  ) => (store ? operation(store) : blobOperation(sessionStoreName, operation));
  const versions = new WeakMap<SessionEntry, string>();
  async function removeExpired(
    id: string,
    entry: SessionEntry | null,
    etag: string,
  ) {
    if (
      entry &&
      (expiresAt(entry) > Date.now() || (entry.leaseUntil ?? 0) > Date.now())
    )
      return;
    // Claim expiry before deleting so a concurrent refresh cannot be removed.
    const result = await run((client) =>
      client.setJSON(id, null, { onlyIfMatch: etag }),
    );
    if (result.modified) await run((client) => client.delete(id));
  }
  async function get(id: string): Promise<SessionEntry | undefined> {
    if (!id) return;
    const record = await run((client) =>
      client.getWithMetadata(id, { type: "json" }),
    );
    if (!record) return;
    if (!record.etag) throw new SessionStorageError("Missing storage version");
    const entry = record.data as SessionEntry | null;
    if (!entry || expiresAt(entry) <= Date.now()) {
      // The scheduled cleanup owns deletion; loading a page only needs a read.
      return;
    }
    if (entry.busy && (entry.leaseUntil ?? 0) <= Date.now()) entry.busy = false;
    versions.set(entry, record.etag);
    return entry;
  }
  async function create(entry: SessionEntry) {
    const result = await run((client) =>
      client.setJSON(entry.state.id, entry, {
        onlyIfNew: true,
      }),
    );
    if (!result.modified)
      throw new SessionStorageError("Session creation conflict");
  }
  async function lock(entry: SessionEntry) {
    if (entry.busy) return false;
    const etag = versions.get(entry);
    if (!etag) throw new SessionStorageError("Missing session version");
    const leased = { ...entry, busy: true, leaseUntil: Date.now() + LEASE_TTL };
    const result = await run((client) =>
      client.setJSON(entry.state.id, leased, {
        onlyIfMatch: etag,
      }),
    );
    if (!result.modified || !result.etag) return false;
    Object.assign(entry, leased);
    versions.set(entry, result.etag);
    return true;
  }
  async function release(entry: SessionEntry) {
    const etag = versions.get(entry);
    if (!etag) throw new SessionStorageError("Missing session lease");
    entry.busy = false;
    delete entry.leaseUntil;
    const result = await run((client) =>
      client.setJSON(entry.state.id, entry, {
        onlyIfMatch: etag,
      }),
    );
    if (!result.modified)
      throw new SessionStorageError("Session changed; retry request");
    if (result.etag) versions.set(entry, result.etag);
  }
  async function remove(entry: SessionEntry) {
    const etag = versions.get(entry);
    if (!etag) throw new SessionStorageError("Missing session version");
    const result = await run((client) =>
      client.setJSON(entry.state.id, null, {
        onlyIfMatch: etag,
      }),
    );
    if (!result.modified)
      throw new SessionStorageError("Session changed; retry request");
    await run((client) => client.delete(entry.state.id));
  }
  async function cleanup() {
    for await (const page of (store ?? temporaryStore()).list({
      paginate: true,
    })) {
      for (const { key } of page.blobs) {
        const record = await run((client) =>
          client.getWithMetadata(key, { type: "json" }),
        );
        if (record?.etag)
          await removeExpired(
            key,
            record.data as SessionEntry | null,
            record.etag,
          );
      }
    }
  }
  return { get, create, lock, release, remove, cleanup };
}
