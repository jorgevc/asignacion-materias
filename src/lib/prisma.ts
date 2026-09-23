import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function getPrisma() {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.startsWith("file:")) {
    connectionString =
      "sqlserver://localhost:1433;database=AsignacionMateriasDev;user=sa;password=LocalDevPassword123!;encrypt=true;trustServerCertificate=true;";
  }
  const adapter = new PrismaMssql(connectionString);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? getPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

