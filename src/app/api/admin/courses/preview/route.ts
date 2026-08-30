import { NextResponse } from "next/server";
import { parseExcelBuffer, suggestMapping, transformUrlForDownload } from "@/lib/excel";
import { safeFetch } from "@/lib/safeFetch";

export const runtime = "nodejs";

async function getBufferFromRequest(req: Request): Promise<Buffer> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const url = form.get("url") as string | null;
    if (file && file.size > 0) {
      const ab = await file.arrayBuffer();
      return Buffer.from(ab);
    }
    if (url) {
      const transformed = transformUrlForDownload(url);
      const res = await safeFetch(transformed);
      if (!res.ok) throw new Error(`No se pudo descargar URL: ${res.status} ${res.statusText}`);
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
    throw new Error("Se requiere file o url");
  } else {
    // JSON body
    const body = await req.json().catch(() => null);
    if (body?.url) {
      const transformed = transformUrlForDownload(body.url);
      const res = await safeFetch(transformed);
      if (!res.ok) throw new Error(`No se pudo descargar URL: ${res.status} ${res.statusText}`);
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
    throw new Error("Se requiere file (multipart) o url (json)");
  }
}

export async function POST(req: Request) {
  try {
    let buffer: Buffer;
    try {
      buffer = await getBufferFromRequest(req);
    } catch (e) {
      return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
    }

    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Archivo demasiado grande (max 5MB)" }, { status: 400 });
    }

    const parsed = parseExcelBuffer(buffer);
    if (parsed.headers.length === 0) {
      return NextResponse.json({ error: "No se detectaron cabeceras" }, { status: 400 });
    }

    const suggestedMapping = suggestMapping(parsed.headers);
    const previewRows = parsed.rows.slice(0, 5);

    return NextResponse.json({
      headers: parsed.headers,
      previewRows,
      totalRows: parsed.totalRows,
      suggestedMapping,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e instanceof Error ? e.message : "Error al parsear Excel") }, { status: 500 });
  }
}
