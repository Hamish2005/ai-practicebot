import { NextRequest, NextResponse } from "next/server";
import { rubricSuggestionInput } from "../../../../scenarios/rubric-suggestions";
import { suggestRubric } from "../../../../server/rubric-suggestions";

export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: NextRequest) {
  const origin = `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  if (request.headers.get("origin") && request.headers.get("origin") !== origin)
    return reply({ error: "Cross-origin requests are not allowed." }, 403);
  let raw: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Missing scenario details." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 100_000) {
        await reader.cancel();
        return reply({ error: "Scenario details are too large." }, 413);
      }
      chunks.push(value);
    }
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  const parsed = rubricSuggestionInput.safeParse(raw);
  if (!parsed.success)
    return reply({ error: parsed.error.issues[0].message }, 400);
  if (process.env.AI_PROVIDER !== "openai" || !process.env.OPENAI_API_KEY)
    return reply(
      {
        error:
          "Practice Bot suggestions need a connected workspace. You can still build the rubric manually.",
      },
      503,
    );
  try {
    const suggestions = await suggestRubric(parsed.data, request.signal);
    return reply({ suggestions });
  } catch {
    return reply(
      {
        error:
          "Could not generate suggestions. Your rubric is unchanged. Please retry.",
      },
      502,
    );
  }
}
