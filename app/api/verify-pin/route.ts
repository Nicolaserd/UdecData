import { NextRequest, NextResponse } from "next/server";
import { isValidPin } from "@/lib/security";

export async function POST(request: NextRequest) {
  // Sin PIN configurado nadie podría entrar: avisarlo en vez de decir "PIN incorrecto"
  if (!process.env.PIN_REGISTRO_BD) {
    return NextResponse.json(
      { valid: false, error: "el servidor no tiene configurado el PIN (PIN_REGISTRO_BD). Avisa al administrador." },
      { status: 500 },
    );
  }
  try {
    const { pin } = await request.json() as { pin: string };

    if (!pin) {
      return NextResponse.json({ valid: false, error: "escribe el PIN antes de continuar." }, { status: 400 });
    }

    return NextResponse.json({ valid: isValidPin(pin) });
  } catch {
    return NextResponse.json({ valid: false, error: "la solicitud no tiene el formato esperado." }, { status: 400 });
  }
}
