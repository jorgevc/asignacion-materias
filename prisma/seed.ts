import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.assignment.deleteMany();
  await prisma.petition.deleteMany();
  await prisma.teacherCourseExp.deleteMany();
  await prisma.course.deleteMany();
  await prisma.semester.deleteMany();
  await prisma.teacher.deleteMany();

  const semActive = await prisma.semester.create({
    data: { label: "2026-2", year: 2026, term: "2", isActive: true },
  });
  await prisma.semester.create({ data: { label: "2026-1", year: 2026, term: "1", isActive: false } });
  await prisma.semester.create({ data: { label: "2025-2", year: 2025, term: "2", isActive: false } });

  const courses = [
    { code: "MAT101", name: "Cálculo I", cupo: 30, dias: "LUN-MIE", horario: "07:00-08:30", ubicacion: "Aula 101" },
    { code: "MAT101", name: "Cálculo I", cupo: 25, dias: "MAR-JUE", horario: "09:00-10:30", ubicacion: "Aula 102" },
    { code: "MAT102", name: "Cálculo II", cupo: 30, dias: "LUN-MIE", horario: "08:30-10:00", ubicacion: "Aula 101" },
    { code: "MAT201", name: "Álgebra Lineal", cupo: 35, dias: "MAR-JUE", horario: "07:00-08:30", ubicacion: "Aula 201" },
    { code: "MAT202", name: "Ecuaciones Diferenciales", cupo: 30, dias: "VIE", horario: "07:00-10:00", ubicacion: "Aula 202" },
    { code: "FIS101", name: "Física I", cupo: 40, dias: "LUN-MIE-VIE", horario: "10:00-11:00", ubicacion: "Lab Fis 1" },
    { code: "FIS102", name: "Física II", cupo: 40, dias: "LUN-MIE", horario: "11:00-12:30", ubicacion: "Lab Fis 2" },
    { code: "INF101", name: "Programación I", cupo: 30, dias: "MAR-JUE", horario: "14:00-15:30", ubicacion: "Lab Comp A" },
    { code: "INF102", name: "Programación II", cupo: 30, dias: "MAR-JUE", horario: "15:30-17:00", ubicacion: "Lab Comp B" },
    { code: "INF201", name: "Estructuras de Datos", cupo: 25, dias: "LUN-MIE", horario: "14:00-15:30", ubicacion: "Lab Comp A" },
    { code: "INF202", name: "Bases de Datos", cupo: 25, dias: "VIE", horario: "14:00-17:00", ubicacion: "Lab Comp C" },
    { code: "EST101", name: "Estadística I", cupo: 35, dias: "LUN-MIE", horario: "17:00-18:30", ubicacion: "Aula 301" },
    { code: "EST102", name: "Estadística II", cupo: 30, dias: "MAR-JUE", horario: "17:00-18:30", ubicacion: "Aula 302" },
  ];

  for (const c of courses) {
    await prisma.course.create({ data: { ...c, semesterId: semActive.id } });
  }

  console.log("Seed done: semester", semActive.label, "with", courses.length, "courses (duplicate codes allowed)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
