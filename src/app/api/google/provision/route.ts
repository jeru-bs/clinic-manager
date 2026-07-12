import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getGoogleConnectionStatus } from "@/lib/google-oauth";
import { provisionGoogleWorkspace } from "@/lib/google-provisioning";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const status = await getGoogleConnectionStatus();

  if (!status.connected) {
    return NextResponse.redirect(
      new URL("/settings?google=not-connected", request.url),
      303
    );
  }

  try {
    await provisionGoogleWorkspace();
  } catch {
    return NextResponse.redirect(
      new URL("/settings?google=provision-failed", request.url),
      303
    );
  }

  return NextResponse.redirect(
    new URL("/settings?google=provisioned", request.url),
    303
  );
}
