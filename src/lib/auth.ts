import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRequiredEnv } from "@/lib/env";
import {
  createSessionToken,
  getSessionMaxAgeSeconds,
  SESSION_COOKIE_NAME,
  verifySessionToken
} from "@/lib/session";
import { safeCompare, sha256 } from "@/lib/security";

export function isPasswordValid(password: string): boolean {
  const configuredHash = getRequiredEnv("APP_PASSWORD_HASH");
  return safeCompare(sha256(password), configuredHash);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token
    ? verifySessionToken(token, getRequiredEnv("SESSION_SECRET"))
    : false;
}

export async function attachSessionCookie(response: NextResponse): Promise<void> {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: await createSessionToken(getRequiredEnv("SESSION_SECRET")),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionMaxAgeSeconds()
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
