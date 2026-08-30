"use client";

import { usePathname, useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";

  const handleLogout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  };

  if (isLogin) return <>{children}</>;

  return (
    <div>
      <div className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">Panel de administración</span>
          <button onClick={handleLogout} className="px-3 py-1.5 rounded border bg-white text-xs hover:bg-zinc-50">
            Cerrar sesión
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}