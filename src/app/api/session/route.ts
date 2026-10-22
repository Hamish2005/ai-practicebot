import { withSessionErrors } from "../../../server/session-errors";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { duplicateCharge } from "../../../scenarios/duplicate-charge";
import {
  finishSession,
  startSession,
  submitTurn,
} from "../../../engine/session";
import { messageSchema } from "../../../engine/schema";
import { getProvider } from "../../../server/config";
import {
  getSession,
  createSession,
  lockSession,
  releaseSession,
  deleteSession,
  sessions,
  sharedSessionsEnabled,
} from "../../../server/store";
import { presentSession } from "../../../server/presentation";
import { scenarioRepository } from "../../../server/scenario-repository";
import { scenarioIdSchema } from "../../../scenarios/authoring";

export const runtime = "nodejs";
const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("start"),
      scenarioId: scenarioIdSchema.optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("turn"),
      message: messageSchema,
      revision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      action: z.literal("end"),
      revision: z.number().int().nonnegative(),
    })
    .strict(),
]);
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });
async function handleGet(request: NextRequest) {
  const entry = await getSession(
    request.cookies.get("practice_session")?.value ?? "",
  );
  return NextResponse.json(
    {
      session: entry
        ? {
            ...presentSession(entry.state, entry.scenario),
            liveRecovery: Boolean(entry.live && entry.state.endedAt === null),
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
async function handlePost(request: NextRequest) {
  // Next.js may normalize the internal hostname (127.0.0.1 to localhost).
  // Validate against the public Host header the browser actually addressed.
  const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== expectedOrigin
  )
    return fail("Cross-origin requests are not allowed.", 403);
  let raw: unknown;
  try {
    const body = await request.text();
    if (body.length > 20_000) return fail("Request is too large.", 413);
    raw = JSON.parse(body);
  } catch {
    return fail("Invalid request body.", 400);
  }
  const parsed = commandSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message, 400);
  const command = parsed.data;
  try {
    const id = request.cookies.get("practice_session")?.value ?? "";
    const entry = await getSession(id);
    if (entry?.live && command.action !== "start")
      return fail(
        "Finish the live conversation before using text controls.",
        409,
      );
    if (command.action === "start") {
      getProvider(); // Validate configuration before starting.
      if (entry?.busy)
        return fail("A turn is still processing. Please wait.", 409);
      if (!sharedSessionsEnabled() && !entry && sessions.size >= 1000)
        return fail(
          "The practice server is full. Please try again later.",
          503,
        );
      if (entry && !(await lockSession(entry)))
        return fail("A turn is still processing. Please retry.", 409);
      let replaced = false;
      try {
        const record = await scenarioRepository.get(
          command.scenarioId ?? duplicateCharge.id,
        );
        if (!record)
          return fail(
            "Scenario not found. Choose another scenario from the library.",
            404,
          );
        const scenario = structuredClone(record.scenario);
        const state = startSession(scenario, crypto.randomUUID(), Date.now());
        await createSession({
          state,
          scenario,
          touchedAt: Date.now(),
          busy: false,
        });
        if (entry) {
          await deleteSession(entry);
          replaced = true;
        }
        const response = NextResponse.json({
          session: presentSession(state, scenario),
        });
        response.cookies.set("practice_session", state.id, {
          httpOnly: true,
          sameSite: "strict",
          secure: request.nextUrl.protocol === "https:",
          path: "/",
          maxAge: 7200,
        });
        return response;
      } finally {
        if (entry && !replaced) await releaseSession(entry);
      }
    }
    if (!entry)
      return fail(
        "Your session expired or the server restarted. Start a new session.",
        410,
      );
    if (entry.busy)
      return fail("A turn is still processing. Please wait and retry.", 409);
    const scenario = entry.scenario ?? duplicateCharge;
    // A lost response can be retried safely without repeating a committed turn.
    if (command.revision < entry.state.revision)
      return NextResponse.json({
        session: presentSession(entry.state, scenario),
      });
    if (command.revision !== entry.state.revision)
      return fail("Session is out of date. Reload and try again.", 409);
    if (entry.state.endedAt !== null)
      return NextResponse.json({
        session: presentSession(entry.state, scenario),
      });
    if (!(await lockSession(entry)))
      return fail("A turn is still processing. Please retry.", 409);
    try {
      entry.state =
        command.action === "end"
          ? {
              ...finishSession(
                scenario,
                entry.state,
                "complete_user",
                Date.now(),
              ),
              revision: entry.state.revision + 1,
            }
          : await submitTurn(
              scenario,
              entry.state,
              command.message,
              getProvider(),
            );
      entry.touchedAt = Date.now();
      return NextResponse.json({
        session: presentSession(entry.state, scenario),
      });
    } finally {
      await releaseSession(entry);
    }
  } catch (error) {
    console.error(
      "Session request failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    const message = error instanceof Error ? error.message : "";
    if (/AI_PROVIDER|OPENAI_API_KEY/.test(message)) return fail(message, 503);
    return fail(
      "We could not confirm that request. Please retry. If this persists, check session storage and the provider connection.",
      502,
    );
  }
}

export const GET = withSessionErrors(handleGet);

export const POST = withSessionErrors(handlePost);
