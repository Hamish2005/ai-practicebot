import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessions, pruneSessions } from "../../../server/store";
import { voiceProvider } from "../../../server/voice";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const scope = globalThis as unknown as { voiceRequests?: Set<string> };
const pending = (scope.voiceRequests ??= new Set<string>());
const identity = z.object({
  sessionId: z.string().min(1),
  revision: z.number().int().nonnegative(),
});
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RangeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function POST(request: NextRequest) {
  const origin = `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  if (request.headers.get("origin") && request.headers.get("origin") !== origin)
    return fail("Cross-origin requests are not allowed.", 403);
  pruneSessions();
  const id = request.cookies.get("practice_session")?.value ?? "";
  const entry = sessions.get(id);
  if (!entry || entry.state.endedAt !== null)
    return fail("Start an active practice session to use voice.", 410);
  if (entry.busy || pending.has(id))
    return fail(
      "Another request is processing. Please try again shortly.",
      409,
    );
  if (
    (process.env.AI_PROVIDER ?? "fake") !== "openai" ||
    !process.env.OPENAI_API_KEY?.trim()
  )
    return fail(
      "Voice needs OpenAI mode and an API key. You can still type your reply.",
      503,
    );
  pending.add(id);
  const revision = entry.state.revision;
  const current = () =>
    sessions.get(id) === entry &&
    entry.state.revision === revision &&
    entry.state.endedAt === null &&
    !entry.busy;
  try {
    const multipart = request.headers
      .get("content-type")
      ?.startsWith("multipart/form-data");
    const body = await boundedBody(
      request,
      multipart ? MAX_BYTES + 16_384 : 4096,
    );
    let sessionId: string;
    let requestedRevision: number;
    let file: File | undefined;
    let index: number | undefined;
    try {
      if (multipart) {
        const form = await new Response(body, {
          headers: { "Content-Type": request.headers.get("content-type")! },
        }).formData();
        const parsed = identity.parse({
          sessionId: form.get("sessionId"),
          revision: form.has("revision") ? Number(form.get("revision")) : NaN,
        });
        sessionId = parsed.sessionId;
        requestedRevision = parsed.revision;
        const audio = form.get("audio");
        if (!(audio instanceof File))
          return fail("Please record an audio message.", 400);
        file = audio;
        if (!file.size || file.size > MAX_BYTES)
          return fail(
            "Record a shorter message (up to 60 seconds / 5 MB).",
            413,
          );
        if (
          !/^(audio\/(webm|mp4|wav|x-wav|ogg|mpeg)|video\/webm)(;|$)/i.test(
            file.type,
          )
        )
          return fail(
            "This recording format is not supported. Try another browser or type your reply.",
            415,
          );
      } else {
        const parsed = identity
          .extend({ messageIndex: z.number().int().nonnegative() })
          .strict()
          .parse(JSON.parse(body.toString("utf8")));
        sessionId = parsed.sessionId;
        requestedRevision = parsed.revision;
        index = parsed.messageIndex;
      }
    } catch {
      return fail("Invalid voice request.", 400);
    }
    if (sessionId !== id || requestedRevision !== revision || !current())
      return fail("The conversation changed. Please try again.", 409);
    const start = performance.now();
    if (file) {
      const text = (
        await voiceProvider.transcribe(file, request.signal)
      ).trim();
      if (!current())
        return fail("The conversation changed. Please record again.", 409);
      if (!text)
        return fail("No speech was recognized. Please try again.", 422);
      if (text.length > 4000)
        return fail(
          "That message is too long. Please record a shorter reply.",
          422,
        );
      return NextResponse.json(
        { text, durationMs: Math.round(performance.now() - start) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const message = entry.state.transcript[index!];
    // Only speak the latest committed bot message, never arbitrary client text or an unapproved draft.
    if (
      index !== entry.state.transcript.length - 1 ||
      message?.role !== "assistant" ||
      message.content.length > 4000
    )
      return fail("That bot reply is not available for playback.", 400);
    const audio = await voiceProvider.speak(message.content, request.signal);
    if (!current())
      return fail("The conversation changed. Playback was cancelled.", 409);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Voice-Duration-Ms": String(Math.round(performance.now() - start)),
      },
    });
  } catch (error) {
    if (error instanceof RangeError)
      return fail(
        "Recording is too large. Please record a shorter message.",
        413,
      );
    return fail(
      "Voice could not connect or process the audio. Please retry or continue typing.",
      502,
    );
  } finally {
    pending.delete(id);
  }
}
