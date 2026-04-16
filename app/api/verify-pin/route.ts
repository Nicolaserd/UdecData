import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json() as { pin: string };

    if (!pin) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    const expected = process.env.PIN_REGISTRO_BD;
    const valid = pin === expected;

    return NextResponse.json({ valid });
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}
