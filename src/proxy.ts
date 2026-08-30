import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminSessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginApi = pathname === "/api/admin/login";
  const isLoginPage = pathname === "/admin/login";
  const authed = await verifyAdminSessionToken(request.cookies.get(ADMIN_COOKIE)?.value);

  if (authed) {
    if (isLoginPage) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (isLoginApi || isLoginPage) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json(
      { error: "No autorizado. Inicie sesión como administrador." },
      { status: 401 }
    );
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};