import { NextRequest, NextResponse } from "next/server";
import { isValidPin } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json() as { pin: string };

    if (!pin) {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    return NextResponse.json({ valid: isValidPin(pin) });
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}
