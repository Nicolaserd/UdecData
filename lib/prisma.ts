import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Si la instancia cacheada no tiene los modelos nuevos (post prisma generate sin reiniciar),
// se descarta y se crea una fresca.
function getOrCreateClient() {
  const cached = globalForPrisma.prisma;
  if (cached && typeof (cached as unknown as Record<string, unknown>).chat !== "undefined") {
    return cached;
  }
  return createPrismaClient();
}

export const prisma = getOrCreateClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
