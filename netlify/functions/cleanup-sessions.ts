import { createSharedSessionStorage } from "../../src/server/session-storage";

export default async function cleanupSessions() {
  await createSharedSessionStorage().cleanup();
}
export const config = { schedule: "*/15 * * * *" };
