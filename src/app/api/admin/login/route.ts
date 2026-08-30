import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  isAdminConfigured,
  verifyAdminPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD no está configurada en el servidor" },
      { status: 500 }
    );
  }
  const body = await req.json().catch(() => null);
  const password = body?.password;
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }
  const token = await createAdminSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}