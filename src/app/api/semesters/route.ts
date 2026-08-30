import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const semesters = await prisma.semester.findMany({
    orderBy: [{ year: "desc" }, { term: "desc" }],
  });
  return NextResponse.json(semesters);
}
