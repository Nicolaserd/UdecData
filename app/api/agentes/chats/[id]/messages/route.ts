import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_MESSAGES = 30;
const MAX_CONTEXT_MESSAGES = 10;

// GET /api/agentes/chats/[id]/messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chatId = parseInt(id);
  if (isNaN(chatId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const rawLimit = req.nextUrl.searchParams.get("limit");
  const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : null;
  const limit = parsedLimit && parsedLimit > 0
    ? Math.min(parsedLimit, MAX_CONTEXT_MESSAGES)
    : null;

  if (limit) {
    const messages = await prisma.chatMessage.findMany({
      where: { chat_id: chatId },
      orderBy: { created_at: "desc" },
      take: limit,
    });

    return NextResponse.json(messages.reverse());
  }

  const messages = await prisma.chatMessage.findMany({
    where: { chat_id: chatId },
    orderBy: { created_at: "asc" },
  });

  return NextResponse.json(messages);
}

// POST /api/agentes/chats/[id]/messages  — guarda mensaje, elimina el más antiguo si supera límite
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chatId = parseInt(id);
  if (isNaN(chatId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const { role, content } = await req.json();
  if (!["user", "assistant"].includes(role) || typeof content !== "string") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const count = await prisma.chatMessage.count({ where: { chat_id: chatId } });

  if (count >= MAX_MESSAGES) {
    const oldest = await prisma.chatMessage.findFirst({
      where: { chat_id: chatId },
      orderBy: { created_at: "asc" },
    });
    if (oldest) {
      await prisma.chatMessage.delete({ where: { id: oldest.id } });
    }
  }

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: { chat_id: chatId, role, content },
    }),
    prisma.chat.update({
      where: { id: chatId },
      data: { updated_at: new Date() },
    }),
  ]);

  return NextResponse.json(message, { status: 201 });
}
