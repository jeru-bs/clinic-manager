import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createPatient, listPatients, validatePatientInput } from "@/lib/patient-store";

export async function GET(): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "נדרשת כניסה למערכת." }, { status: 401 });
  }

  return NextResponse.json({ patients: await listPatients() });
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "נדרשת כניסה למערכת." }, { status: 401 });
  }

  try {
    const input = validatePatientInput(await request.json());
    const patient = await createPatient(input);
    return NextResponse.json({ patient }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "לא ניתן היה לשמור מטופל."
      },
      { status: 400 }
    );
  }
}
