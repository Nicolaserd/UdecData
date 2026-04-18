import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_CHATS = 20;

// GET /api/agentes/chats?agent=analista
export async function GET(req: NextRequest) {
  const agent = req.nextUrl.searchParams.get("agent");
  if (!agent || !["analista", "soporte"].includes(agent)) {
    return NextResponse.json({ error: "Agente inválido" }, { status: 400 });
  }

  const chats = await prisma.chat.findMany({
    where: { agent_type: agent },
    orderBy: { updated_at: "desc" },
    take: MAX_CHATS,
  });

  return NextResponse.json(chats);
}

// POST /api/agentes/chats  — crea chat, elimina el más antiguo si supera el límite
export async function POST(req: NextRequest) {
  const { agent, title } = await req.json();
  if (!agent || !["analista", "soporte"].includes(agent)) {
    return NextResponse.json({ error: "Agente inválido" }, { status: 400 });
  }

  const count = await prisma.chat.count({ where: { agent_type: agent } });

  if (count >= MAX_CHATS) {
    const oldest = await prisma.chat.findFirst({
      where: { agent_type: agent },
      orderBy: { updated_at: "asc" },
    });
    if (oldest) {
      await prisma.chat.delete({ where: { id: oldest.id } });
    }
  }

  const chat = await prisma.chat.create({
    data: {
      agent_type: agent,
      title: (title as string)?.slice(0, 60) || "Nueva conversación",
    },
  });

  return NextResponse.json(chat, { status: 201 });
}
