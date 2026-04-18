import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE /api/agentes/chats/[id]  — elimina chat y sus mensajes (CASCADE)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chatId = parseInt(id);
  if (isNaN(chatId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  await prisma.chat.delete({ where: { id: chatId } });
  return NextResponse.json({ ok: true });
}
