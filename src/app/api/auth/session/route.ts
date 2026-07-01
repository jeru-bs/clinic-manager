import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ authenticated: await isAuthenticated() });
}
