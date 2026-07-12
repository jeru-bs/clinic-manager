import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, writeGoogleToken } from "@/lib/google-oauth";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("google_oauth_state")?.value;
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/settings?google=denied", request.url));
  }

  if (!state || !savedState || state !== savedState || !code) {
    return NextResponse.redirect(new URL("/settings?google=invalid", request.url));
  }

  try {
    await writeGoogleToken(await exchangeCodeForTokens(request.nextUrl.origin, code));
  } catch {
    return NextResponse.redirect(new URL("/settings?google=failed", request.url));
  }

  const response = NextResponse.redirect(new URL("/settings?google=connected", request.url));
  response.cookies.set({
    name: "google_oauth_state",
    value: "",
    path: "/",
    maxAge: 0
  });

  return response;
}
