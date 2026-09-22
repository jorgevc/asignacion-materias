import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  analyzeExcelFill,
  processAndFillExcel,
  ColumnMapping,
  DbCourseInfo,
  DbCourseAssignment,
} from "@/lib/excelFiller";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Se requiere multipart/form-data con archivo 'file'" }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const semesterIdStr = form.get("semesterId") as string | null;
    const mode = (form.get("mode") as string | null) || "fill";
    const mappingStr = form.get("mapping") as string | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo Excel" }, { status: 400 });
    }

    if (!semesterIdStr) {
      return NextResponse.json({ error: "semesterId es obligatorio" }, { status: 400 });
    }

    const semesterId = Number(semesterIdStr);
    if (Number.isNaN(semesterId)) {
      return NextResponse.json({ error: "semesterId inválido" }, { status: 400 });
    }

    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) {
      return NextResponse.json({ error: "Semestre no encontrado" }, { status: 404 });
    }

    let userMapping: Partial<ColumnMapping> | undefined;
    if (mappingStr) {
      try {
        userMapping = JSON.parse(mappingStr);
      } catch {
        return NextResponse.json({ error: "mapping JSON inválido" }, { status: 400 });
      }
    }

    const ab = await file.arrayBuffer();
    const buffer = Buffer.from(ab);

    // Obtener materias del semestre
    const courses = await prisma.course.findMany({
      where: { semesterId },
      select: { id: true, code: true, name: true, dias: true, horario: true },
    });

    const dbCourses: DbCourseInfo[] = courses.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      dias: c.dias,
      horario: c.horario,
    }));

    // Obtener asignaciones del semestre
    const assignments = await prisma.assignment.findMany({
      where: { semesterId },
      include: { teacher: true, course: true },
    });

    const dbAssignments: DbCourseAssignment[] = assignments.map((a) => ({
      id: a.id,
      courseId: a.courseId,
      courseCode: a.course.code,
      courseName: a.course.name,
      dias: a.course.dias,
      horario: a.course.horario,
      slotNo: a.slotNo,
      teacher: {
        id: a.teacher.id,
        name: a.teacher.name,
        employeeId: a.teacher.employeeId,
        email: a.teacher.email,
      },
    }));

    if (mode === "preview") {
      const analysis = await analyzeExcelFill(buffer, dbCourses, dbAssignments, userMapping);
      return NextResponse.json({
        ok: true,
        semesterId,
        semesterLabel: semester.label,
        analysis,
      });
    }

    // Modo fill: genera el archivo Excel modificado
    const { filledBuffer, analysis } = await processAndFillExcel(
      buffer,
      dbCourses,
      dbAssignments,
      userMapping
    );

    const safeLabel = semester.label.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `materias_asignadas_${safeLabel}.xlsx`;

    return new Response(new Uint8Array(filledBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Analysis-Matched": String(analysis.matchedCount),
        "X-Analysis-Vacant": String(analysis.vacantCount),
        "X-Analysis-Missing": String(analysis.missingAssignmentsInExcel.length),
        "X-Analysis-Extra": String(analysis.extraCoursesInExcel.length),
      },
    });
  } catch (err) {
    console.error("Error en fill-excel:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : "Error interno al procesar el archivo Excel") },
      { status: 500 }
    );
  }
}
