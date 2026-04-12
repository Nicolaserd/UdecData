import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check env var
  checks.DATABASE_URL = process.env.DATABASE_URL ? "set" : "MISSING";

  // Check DB connection
  try {
    const count = await prisma.estudiante.count();
    checks.db_connection = "ok";
    checks.db_count = String(count);
  } catch (error) {
    checks.db_connection = "FAILED";
    checks.db_error = error instanceof Error ? error.message : String(error);
  }

  const ok = checks.db_connection === "ok";
  return NextResponse.json(checks, { status: ok ? 200 : 500 });
}
