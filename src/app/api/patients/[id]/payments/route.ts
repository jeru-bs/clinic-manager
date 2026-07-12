import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  createPayment,
  listPayments,
  validatePaymentInput
} from "@/lib/payment-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: "נדרשת כניסה למערכת." }, { status: 401 });
  }

  const { id } = await params;
  return NextResponse.json({ payments: await listPayments(id) });
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
    const input = validatePaymentInput(id, await request.json());
    const payment = await createPayment(input);
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "לא ניתן היה לשמור תשלום."
      },
      { status: 400 }
    );
  }
}
