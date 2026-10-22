import type { NextRequest } from "next/server";
import { saveScenarioRequest } from "../../../../server/scenario-api";
export const runtime = "nodejs";
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return saveScenarioRequest(request, (await context.params).id);
}
