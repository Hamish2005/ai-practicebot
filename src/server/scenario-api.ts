import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { authoredScenarioSchema } from "../scenarios/authoring";
import { scenarioRepository, ScenarioStoreError } from "./scenario-repository";

const saveSchema = z
  .object({
    scenario: authoredScenarioSchema,
    revision: z.number().int().nonnegative().optional(),
  })
  .strict();
export async function saveScenarioRequest(request: NextRequest, id?: string) {
  const origin = `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  if (request.headers.get("origin") && request.headers.get("origin") !== origin)
    return NextResponse.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  try {
    const body = await request.text();
    if (body.length > 200_000)
      return NextResponse.json(
        { error: "This scenario is too large." },
        { status: 413 },
      );
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }
    const { scenario, revision } = saveSchema.parse(raw);
    const record = await scenarioRepository.save(scenario, id, revision);
    return NextResponse.json({ record }, { status: id ? 200 : 201 });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n"),
        },
        { status: 400 },
      );
    if (error instanceof ScenarioStoreError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(
      "Scenario save failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return NextResponse.json(
      {
        error:
          "The scenario could not be saved. Your edits are still in the form. Please retry in a moment.",
      },
      { status: 500 },
    );
  }
}
