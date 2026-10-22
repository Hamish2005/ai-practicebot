import { NextRequest, NextResponse } from "next/server";

export function withSessionErrors(
  handler: (request: NextRequest) => Promise<Response>,
) {
  return async (request: NextRequest) => {
    try {
      return await handler(request);
    } catch {
      return NextResponse.json(
        { error: "Session storage is temporarily unavailable. Please retry." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
