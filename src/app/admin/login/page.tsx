"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Error al iniciar sesión");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm border rounded-lg bg-white p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Administración</h1>
          <p className="text-sm text-zinc-600 mt-1">Ingrese la contraseña de administrador para continuar.</p>
        </div>
        {error && (
          <div className="px-3 py-2 rounded text-sm bg-red-50 border border-red-200 text-red-800">{error}</div>
        )}
        <div>
          <label className="text-sm font-medium">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full px-4 py-2 rounded bg-zinc-900 text-white text-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Verificando..." : "Iniciar sesión"}
        </button>
      </form>
    </main>
  );
}