import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  createSessionRecord,
  listSessions,
  validateSessionInput
} from "@/lib/session-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "נדרשת כניסה למערכת." }, { status: 401 });
  }

  const { id } = await params;
  return NextResponse.json({ sessions: await listSessions(id) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "נדרשת כניסה למערכת." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const input = validateSessionInput(id, await request.json());
    const session = await createSessionRecord(input);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "לא ניתן היה לשמור מפגש."
      },
      { status: 400 }
    );
  }
}
