import { NextResponse } from "next/server";
import { attachSessionCookie, isPasswordValid } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";

    if (!password || !isPasswordValid(password)) {
      return NextResponse.json(
        { message: "הכניסה נכשלה. בדקו את הסיסמה ונסו שוב." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    await attachSessionCookie(response);
    return response;
  } catch {
    return NextResponse.json(
      { message: "לא ניתן היה לבצע כניסה כרגע." },
      { status: 400 }
    );
  }
}
