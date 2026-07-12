import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  deletePatient,
  updatePatient,
  validatePatientInput
} from "@/lib/patient-store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "נדרשת כניסה למערכת." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const input = validatePatientInput(await request.json());
    const patient = await updatePatient(id, input);

    if (!patient) {
      return NextResponse.json({ message: "המטופל לא נמצא." }, { status: 404 });
    }

    return NextResponse.json({ patient });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "לא ניתן היה לעדכן מטופל."
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "נדרשת כניסה למערכת." }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deletePatient(id);

  if (!deleted) {
    return NextResponse.json({ message: "המטופל לא נמצא." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
