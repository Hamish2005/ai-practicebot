import type { NextRequest } from "next/server";
import { saveScenarioRequest } from "../../../server/scenario-api";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return saveScenarioRequest(request);
}
