import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  buildGoogleAuthorizationUrl,
  hasGoogleOAuthConfig
} from "@/lib/google-oauth";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!hasGoogleOAuthConfig()) {
    return NextResponse.redirect(new URL("/settings?google=missing-config", request.url));
  }

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(
    buildGoogleAuthorizationUrl(request.nextUrl.origin, state)
  );

  response.cookies.set({
    name: "google_oauth_state",
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60
  });

  return response;
}
