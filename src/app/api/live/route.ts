import { withSessionErrors } from "../../../server/session-errors";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession, lockSession, releaseSession } from "../../../server/store";
import { connectRealtime, liveGreeting } from "../../../server/realtime";
import { getProvider } from "../../../server/config";
import { presentSession } from "../../../server/presentation";
import { finishSession, submitTurn } from "../../../engine/session";
import type { EndReason } from "../../../engine/types";
import { duplicateCharge } from "../../../scenarios/duplicate-charge";
import {
  practiceVoices,
  defaultPracticeVoice,
} from "../../../engine/voice-options";

export const runtime = "nodejs";
const eventSchema = z
  .object({
    id: z.string().min(1).max(200),
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(4000),
  })
  .strict();
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("connect"),
      sessionId: z.string(),
      revision: z.number().int(),
      sdp: z.string().min(1).max(30_000),
      voice: z.enum(practiceVoices).default(defaultPracticeVoice),
    })
    .strict(),
  z
    .object({
      action: z.enum(["sync", "end"]),
      sessionId: z.string(),
      liveId: z.string(),
      events: z.array(eventSchema).max(200),
    })
    .strict(),
]);
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function handlePost(request: NextRequest) {
  const origin = `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  if (request.headers.get("origin") && request.headers.get("origin") !== origin)
    return json({ error: "Cross-origin requests are not allowed." }, 403);
  let raw: unknown;
  try {
    // Bound the streamed body too, rather than trusting Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Missing request." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 900_000) {
        await reader.cancel();
        return json({ error: "Request too large." }, 413);
      }
      chunks.push(value);
    }
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    return json({ error: "Invalid live conversation request." }, 400);
  const command = parsed.data;
  const entry = await getSession(
    request.cookies.get("practice_session")?.value ?? "",
  );
  if (!entry || entry.state.id !== command.sessionId)
    return json({ error: "Session expired. Reload to start again." }, 410);
  if (entry.busy)
    return json({ error: "Scoring is still processing. Please retry." }, 409);
  if (process.env.AI_PROVIDER !== "openai" || !process.env.OPENAI_API_KEY)
    return json(
      { error: "Live conversation needs an OpenAI API connection." },
      503,
    );
  const scenario = entry.scenario ?? duplicateCharge;
  if (!(await lockSession(entry)))
    return json({ error: "Scoring is still processing. Please retry." }, 409);
  try {
    if (command.action === "connect") {
      if (
        entry.state.endedAt !== null ||
        command.revision !== entry.state.revision
      )
        return json(
          { error: "Start a new session to connect live voice." },
          409,
        );
      const startingState =
        entry.state.turns === 0
          ? {
              ...entry.state,
              transcript: [
                { role: "assistant" as const, content: liveGreeting },
              ],
            }
          : entry.state;
      const sdp = await connectRealtime(
        command.sdp,
        scenario,
        startingState,
        command.voice,
      );
      entry.state = startingState;
      entry.live = { id: crypto.randomUUID(), events: [] };
      entry.touchedAt = Date.now();
      return json({
        sdp,
        liveId: entry.live.id,
        session: presentSession(entry.state, scenario),
      });
    }
    const live = entry.live;
    if (!live || live.id !== command.liveId)
      return json(
        { error: "Live connection no longer belongs to this session." },
        409,
      );
    if (entry.state.endedAt !== null)
      return json({
        session: presentSession(entry.state, scenario),
        shouldStop: true,
      });
    if (
      new Set(command.events.map((e) => e.id)).size !== command.events.length ||
      command.events.length < live.events.length ||
      live.events.some(
        (e, i) => JSON.stringify(e) !== JSON.stringify(command.events[i]),
      )
    )
      return json(
        {
          error: "The saved transcript cannot be changed. Reload the session.",
        },
        409,
      );
    let state = entry.state;
    let stopReason = live.stopReason;
    for (const event of command.events.slice(live.events.length)) {
      if (event.role === "user") {
        state = await submitTurn(
          scenario,
          state,
          event.content,
          getProvider(),
          Date.now,
          true,
        );
        if (state.decision.startsWith("complete_"))
          stopReason ??= state.decision as EndReason;
      } else {
        state = {
          ...state,
          transcript: [
            ...state.transcript,
            { role: event.role, content: event.content },
          ],
          revision: state.revision + 1,
        };
      }
    }
    if (command.action === "end")
      state = {
        ...finishSession(
          scenario,
          state,
          stopReason ?? "complete_user",
          Date.now(),
        ),
        revision: state.revision + 1,
      };
    // Commit state and cursor together only after every assessment succeeds.
    entry.state = state;
    live.events = command.events;
    live.stopReason = stopReason;
    entry.touchedAt = Date.now();
    return json({
      session: presentSession(state, scenario),
      shouldStop: Boolean(stopReason),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Realtime connection failed (HTTP")
    )
      return json(
        { error: error.message + ". Check model access and API billing." },
        502,
      );
    return json(
      {
        error:
          "Live connection or scoring failed. Your saved scores are unchanged. Retry to finish scoring.",
      },
      502,
    );
  } finally {
    await releaseSession(entry);
  }
}

export const POST = withSessionErrors(handlePost);
