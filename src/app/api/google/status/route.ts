import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getGoogleConnectionStatus } from "@/lib/google-oauth";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getGoogleConnectionStatus());
}
