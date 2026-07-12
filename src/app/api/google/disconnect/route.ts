import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { clearGoogleToken } from "@/lib/google-oauth";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await clearGoogleToken();
  return NextResponse.redirect(
    new URL("/settings?google=disconnected", request.url),
    303
  );
}
