import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/agentes/chats/[id]  — actualiza el título del chat
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chatId = parseInt(id);
  if (isNaN(chatId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  const { title } = await req.json();
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Título inválido" }, { status: 400 });
  }
  const chat = await prisma.chat.update({
    where: { id: chatId },
    data: { title: title.slice(0, 80) },
  });
  return NextResponse.json(chat);
}

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
