import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseExcelBuffer, transformUrlForDownload } from "@/lib/excel";

export const runtime = "nodejs";

async function getBufferAndMapping(req: Request): Promise<{ buffer: Buffer; mapping: Record<string, string>; semesterId: number; mode: "replace" | "append" }> {
  const contentType = req.headers.get("content-type") || "";
  let buffer: Buffer | null = null;
  let mapping: Record<string, string> | null = null;
  let semesterId: string | null = null;
  let mode: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const url = form.get("url") as string | null;
    const mappingStr = form.get("mapping") as string | null;
    semesterId = form.get("semesterId") as string | null;
    mode = (form.get("mode") as string | null) || "replace";
    if (mappingStr) {
      try {
        mapping = JSON.parse(mappingStr);
      } catch {
        throw new Error("mapping JSON inválido");
      }
    }
    if (file && file.size > 0) {
      const ab = await file.arrayBuffer();
      buffer = Buffer.from(ab);
    } else if (url) {
      const transformed = transformUrlForDownload(url);
      const res = await fetch(transformed);
      if (!res.ok) throw new Error(`No se pudo descargar URL: ${res.status} ${res.statusText}`);
      const ab = await res.arrayBuffer();
      buffer = Buffer.from(ab);
    }
  } else {
    const body = await req.json().catch(() => null);
    if (!body) throw new Error("Body inválido");
    // body may contain url and mapping
    if (body.url) {
      const transformed = transformUrlForDownload(body.url);
      const res = await fetch(transformed);
      if (!res.ok) throw new Error(`No se pudo descargar URL: ${res.status} ${res.statusText}`);
      const ab = await res.arrayBuffer();
      buffer = Buffer.from(ab);
    } else if (body.fileBase64) {
      buffer = Buffer.from(body.fileBase64, "base64");
    }
    mapping = body.mapping;
    semesterId = body.semesterId ? String(body.semesterId) : null;
    mode = body.mode || "replace";
  }

  if (!buffer) throw new Error("Se requiere file o url");
  if (!mapping) throw new Error("Se requiere mapping (confirmación de columnas)");
  if (!semesterId) throw new Error("semesterId requerido");
  const sid = Number(semesterId);
  if (Number.isNaN(sid)) throw new Error("semesterId inválido");
  const m = mode === "append" ? "append" : "replace";
  return { buffer, mapping, semesterId: sid, mode: m };
}

export async function POST(req: Request) {
  try {
    let buffer: Buffer, mapping: Record<string, string>, semesterId: number, mode: "replace" | "append";
    try {
      const parsed = await getBufferAndMapping(req);
      buffer = parsed.buffer;
      mapping = parsed.mapping;
      semesterId = parsed.semesterId;
      mode = parsed.mode;
    } catch (e) {
      return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
    }

    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Archivo demasiado grande (max 5MB)" }, { status: 400 });
    }

    const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
    if (!semester) return NextResponse.json({ error: "Semestre no encontrado" }, { status: 404 });

    // Validate mapping: must have at least code and name mapped to some column index
    const mappedFields = Object.values(mapping);
    if (!mappedFields.includes("code")) {
      return NextResponse.json({ error: "Mapeo debe incluir 'code' en alguna columna (confirmación requerida)" }, { status: 400 });
    }
    if (!mappedFields.includes("name")) {
      return NextResponse.json({ error: "Mapeo debe incluir 'name' en alguna columna" }, { status: 400 });
    }
    // Check for duplicate field mapping (same field mapped twice)
    const counts = new Map<string, number>();
    for (const f of mappedFields) {
      if (!f || f === "ignore") continue;
      counts.set(f, (counts.get(f) || 0) + 1);
    }
    for (const [f, c] of counts) {
      if (c > 1) return NextResponse.json({ error: `Campo '${f}' mapeado a múltiples columnas` }, { status: 400 });
    }

    const parsed = parseExcelBuffer(buffer);
    const headers = parsed.headers;
    const rows = parsed.rows;

    // Build reverse mapping: field -> col index
    const fieldToCol = new Map<string, number>();
    for (const [colIdxStr, field] of Object.entries(mapping)) {
      const idx = Number(colIdxStr);
      if (Number.isNaN(idx) || !field || field === "ignore") continue;
      fieldToCol.set(field, idx);
    }

    const toCreate: { code: string; name: string; cupo: number | null; dias: string | null; horario: string | null; ubicacion: string | null }[] = [];
    const errors: { row: number; reason: string }[] = [];

    rows.forEach((row, rowIdx) => {
      const rowNum = rowIdx + 2; // 1-indexed excel row (header is 1)
      const getField = (field: string): string => {
        const colIdx = fieldToCol.get(field);
        if (colIdx === undefined) return "";
        return String(row[colIdx] || "").trim();
      };

      const code = getField("code");
      const name = getField("name");
      const cupoStr = getField("cupo");
      const dias = getField("dias");
      const horario = getField("horario");
      const ubicacion = getField("ubicacion");

      if (!code || !name) {
        errors.push({ row: rowNum, reason: "code y name son obligatorios" });
        return;
      }

      let cupo: number | null = null;
      if (cupoStr) {
        const parsedCupo = Number(String(cupoStr).replace(/[^0-9]/g, ""));
        if (!Number.isNaN(parsedCupo) && parsedCupo >= 0) cupo = parsedCupo;
        else {
          errors.push({ row: rowNum, reason: `cupo inválido: ${cupoStr}` });
          return;
        }
      }

      toCreate.push({
        code,
        name,
        cupo,
        dias: dias || null,
        horario: horario || null,
        ubicacion: ubicacion || null,
      });
    });

    if (toCreate.length === 0) {
      return NextResponse.json({ error: "No hay filas válidas para importar", errors, totalRows: parsed.totalRows }, { status: 400 });
    }

    // If mode is replace, delete existing courses for semester (and related petitions will cascade? Need to handle petitions FK)
    // petitions have CASCADE on course delete, so deleting courses will delete petitions for those courses. That's expected to avoid orphan.
    // Alternatively we could keep petitions but they would reference deleted courses -> cascade will delete petitions.
    // We should warn but proceed.
    let deletedCount = 0;
    if (mode === "replace") {
      // Count before delete
      deletedCount = await prisma.course.count({ where: { semesterId } });
      // Delete courses - cascade will delete petitions referencing them
      await prisma.course.deleteMany({ where: { semesterId } });
    }

    // Create courses
    let createdCount = 0;
    // Use transaction for batch create
    await prisma.$transaction(async (tx) => {
      for (const c of toCreate) {
        await tx.course.create({
          data: {
            code: c.code,
            name: c.name,
            cupo: c.cupo,
            dias: c.dias,
            horario: c.horario,
            ubicacion: c.ubicacion,
            semesterId,
          },
        });
        createdCount++;
      }
    });

    return NextResponse.json({
      ok: true,
      semesterId,
      mode,
      totalRows: parsed.totalRows,
      imported: createdCount,
      deleted: deletedCount,
      errors,
      skipped: errors.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e instanceof Error ? e.message : "Error interno") }, { status: 500 });
  }
}
