"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AdminTeacher = {
  id: number;
  email: string;
  name: string;
  employeeId: string | null;
  phone: string | null;
  affiliation: string;
  isActive?: boolean | null;
  note: string | null;
  _count?: { petitions: number; assignments: number };
};
type NewTeacher = { name: string; email: string; employeeId: string; phone: string; affiliation: string; isActive: boolean; note: string };

const EMPTY_NEW: NewTeacher = { name: "", email: "", employeeId: "", phone: "", affiliation: "Interno", isActive: true, note: "" };

export default function TeachersPage() {
  const [teachersAdmin, setTeachersAdmin] = useState<AdminTeacher[]>([]);
  const [teacherEdit, setTeacherEdit] = useState<Record<number, Partial<NewTeacher>>>({});
  const [newTeacher, setNewTeacher] = useState<NewTeacher>(EMPTY_NEW);
  const [teachersMsg, setTeachersMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const fetchTeachers = async () => {
    const res = await fetch("/api/teachers");
    const j = await res.json();
    if (Array.isArray(j)) setTeachersAdmin(j);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleCreateTeacher = async () => {
    setTeachersMsg(null);
    try {
      const res = await fetch("/api/teachers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newTeacher) });
      const j = await res.json();
      if (!res.ok) setTeachersMsg({ type: "error", text: j.error });
      else {
        setTeachersMsg({ type: "ok", text: `Docente creado: ${j.name}` });
        setNewTeacher(EMPTY_NEW);
        fetchTeachers();
      }
    } catch (e) {
      setTeachersMsg({ type: "error", text: String(e) });
    }
  };

  const handleSaveTeacher = async (id: number) => {
    setTeachersMsg(null);
    const patch = teacherEdit[id];
    if (!patch) return;
    try {
      const res = await fetch("/api/teachers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
      const j = await res.json();
      if (!res.ok) setTeachersMsg({ type: "error", text: j.error });
      else {
        setTeachersMsg({ type: "ok", text: `Docente actualizado: ${j.name}` });
        setTeacherEdit((prev) => { const n = { ...prev }; delete n[id]; return n; });
        fetchTeachers();
      }
    } catch (e) {
      setTeachersMsg({ type: "error", text: String(e) });
    }
  };


  const handleDeleteTeacher = async (id: number, name: string) => {
    if (!confirm(`¿Borrar docente ${name}?`)) return;
    setTeachersMsg(null);
    try {
      const res = await fetch(`/api/teachers?id=${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) setTeachersMsg({ type: "error", text: j.error });
      else {
        setTeachersMsg({ type: "ok", text: `Docente borrado: ${name}` });
        fetchTeachers();
      }
    } catch (e) {
      setTeachersMsg({ type: "error", text: String(e) });
    }
  };

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{
    totalRows: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errorCount: number;
    results: Array<{
      rowNumber: number;
      success: boolean;
      action?: string;
      employeeId?: string | null;
      name?: string;
      email?: string;
      error?: string;
    }>;
  } | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      setTeachersMsg({ type: "error", text: "Selecciona un archivo Excel (.xlsx, .xls) o CSV (.csv)" });
      return;
    }
    setBulkLoading(true);
    setTeachersMsg(null);
    setBulkSummary(null);
    try {
      const fd = new FormData();
      fd.append("file", bulkFile);
      const res = await fetch("/api/admin/teachers/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setTeachersMsg({ type: "error", text: data.error || "Error al importar el archivo" });
      } else {
        setBulkSummary(data.summary);
        setTeachersMsg({
          type: "ok",
          text: `Proceso completado: ${data.summary.createdCount} creados, ${data.summary.updatedCount} actualizados, ${data.summary.errorCount} errores.`,
        });
        setBulkFile(null);
        // Reset file input value
        const inputElem = document.getElementById("bulk-teacher-input") as HTMLInputElement;
        if (inputElem) inputElem.value = "";
        await fetchTeachers();
      }
    } catch (e) {
      setTeachersMsg({ type: "error", text: String(e) });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.location.href = "/api/admin/teachers/import?template=true";
  };

  const filteredTeachers = teachersAdmin.filter((t) => {
    const active = Boolean(t.isActive ?? true);
    if (statusFilter === "active" && !active) return false;
    if (statusFilter === "inactive" && active) return false;
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase().trim();
    const nameMatch = t.name.toLowerCase().includes(q);
    const empMatch = (t.employeeId || "").toLowerCase().includes(q);
    const emailMatch = t.email.toLowerCase().includes(q);
    const phoneMatch = (t.phone || "").toLowerCase().includes(q);
    return nameMatch || empMatch || emailMatch || phoneMatch;
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Profesores ({teachersAdmin.length})</h1>
          <p className="text-sm text-zinc-600">
            <Link href="/admin" className="text-indigo-600 hover:underline">← Volver al panel de administración</Link>
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="px-3 py-1.5 rounded border border-zinc-300 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 shadow-sm flex items-center gap-1.5"
        >
          <span>📥</span> Descargar Plantilla CSV
        </button>
      </div>

      {teachersMsg && (
        <div className={`px-4 py-3 rounded-lg text-sm ${teachersMsg.type === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
          {teachersMsg.text}
        </div>
      )}

      {/* Sección Carga Masiva de Profesores (Opción 1) */}
      <div className="border border-indigo-100 rounded-xl bg-gradient-to-r from-indigo-50/50 via-white to-sky-50/40 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 flex items-center gap-2">
              <span>📋</span> Carga Masiva del Padrón Docente
            </h2>
            <p className="text-xs text-zinc-600 mt-0.5">
              Sube la lista oficial en <strong>Excel (.xlsx, .xls)</strong> o <strong>CSV</strong>. Da de alta profesores nuevos y actualiza correos, teléfonos o nombres sin alterar peticiones previas.
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="self-start md:self-auto text-xs text-indigo-700 hover:text-indigo-900 underline font-medium"
          >
            Obtener formato de ejemplo (.csv)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-zinc-200">
          <input
            id="bulk-teacher-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
            className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
          />
          <button
            onClick={handleBulkUpload}
            disabled={!bulkFile || bulkLoading}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
          >
            {bulkLoading ? "Procesando padrón..." : "Subir e Importar Profesores"}
          </button>
        </div>

        {/* Resumen del último resultado */}
        {bulkSummary && (
          <div className="mt-4 p-4 rounded-lg bg-white border border-zinc-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-800">Resultado de la importación:</span>
              {bulkSummary.errorCount > 0 && (
                <button
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                  className="text-red-600 hover:underline font-medium"
                >
                  {showErrorDetails ? "Ocultar detalles de errores" : `Ver ${bulkSummary.errorCount} errores`}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 font-medium">
                Filas analizadas: {bulkSummary.totalRows}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-green-50 border border-green-200 text-green-700 font-medium">
                ✓ {bulkSummary.createdCount} Nuevos Creados
              </span>
              <span className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                ↺ {bulkSummary.updatedCount} Actualizados
              </span>
              {bulkSummary.skippedCount > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-500 font-medium">
                  {bulkSummary.skippedCount} Omitidos (vacíos)
                </span>
              )}
              {bulkSummary.errorCount > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-700 font-medium">
                  ✕ {bulkSummary.errorCount} Errores
                </span>
              )}
            </div>

            {showErrorDetails && bulkSummary.errorCount > 0 && (
              <div className="mt-2 border rounded p-2 bg-red-50/50 max-h-40 overflow-auto space-y-1">
                <div className="font-medium text-red-900 pb-1 border-b border-red-200">Filas con observaciones:</div>
                {bulkSummary.results
                  .filter((r) => !r.success)
                  .map((err, idx) => (
                    <div key={idx} className="text-red-700 flex gap-2">
                      <span className="font-semibold">Fila {err.rowNumber}:</span>
                      <span>{err.error}</span>
                      {err.employeeId && <span className="text-zinc-500">({err.employeeId})</span>}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sección Manual */}
      <div className="border rounded-lg bg-white p-4">
        <h2 className="font-semibold text-sm mb-3">Alta Individual y Edición Rápida</h2>
        {/* Alta de docente */}
        <div className="flex flex-wrap items-end gap-2 mb-4 pb-3 border-b">
          <div>
            <label className="text-xs font-medium block">No. empleado *</label>
            <input value={newTeacher.employeeId} onChange={(e) => setNewTeacher((p) => ({ ...p, employeeId: e.target.value }))} className="w-28 border rounded px-2 py-1.5 text-sm" placeholder="100345678" />
          </div>
          <div>
            <label className="text-xs font-medium block">Nombre *</label>
            <input value={newTeacher.name} onChange={(e) => setNewTeacher((p) => ({ ...p, name: e.target.value }))} className="w-52 border rounded px-2 py-1.5 text-sm" placeholder="APELLIDOS NOMBRE" />
          </div>
          <div>
            <label className="text-xs font-medium block">Email *</label>
            <input value={newTeacher.email} onChange={(e) => setNewTeacher((p) => ({ ...p, email: e.target.value }))} className="w-56 border rounded px-2 py-1.5 text-sm" placeholder="profesor@correo.buap.mx" />
          </div>
          <div>
            <label className="text-xs font-medium block">Celular</label>
            <input value={newTeacher.phone} onChange={(e) => setNewTeacher((p) => ({ ...p, phone: e.target.value }))} className="w-32 border rounded px-2 py-1.5 text-sm" placeholder="2221234567" />
          </div>
          <div>
            <label className="text-xs font-medium block">Adscripción</label>
            <select value={newTeacher.affiliation} onChange={(e) => setNewTeacher((p) => ({ ...p, affiliation: e.target.value }))} className="border rounded px-2 py-1.5 text-sm bg-white">
              <option>Interno</option>
              <option>Externo</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 pb-2">
            <label className="text-xs font-medium flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newTeacher.isActive}
                onChange={(e) => setNewTeacher((p) => ({ ...p, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Activo</span>
            </label>
          </div>
          <div className="flex-1 min-w-48">
            <label className="text-xs font-medium block">Nota</label>
            <input value={newTeacher.note} onChange={(e) => setNewTeacher((p) => ({ ...p, note: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <button onClick={handleCreateTeacher} disabled={!newTeacher.name || !newTeacher.email || !newTeacher.employeeId} className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
            Agregar
          </button>
        </div>

        {/* Buscador y Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="🔍 Buscar por nombre, No. de empleado, correo o celular..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full border rounded-lg px-3 py-1.5 text-xs bg-zinc-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {filterText && (
              <button
                onClick={() => setFilterText("")}
                className="absolute right-2.5 top-1.5 text-xs text-zinc-400 hover:text-zinc-700"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro por estado activo/inactivo */}
          <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg text-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                statusFilter === "all" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Todos ({teachersAdmin.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                statusFilter === "active" ? "bg-white text-emerald-700 shadow-xs" : "text-zinc-600 hover:text-emerald-700"
              }`}
            >
              Activos ({teachersAdmin.filter((t) => Boolean(t.isActive ?? true)).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                statusFilter === "inactive" ? "bg-white text-zinc-800 shadow-xs" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              Inactivos ({teachersAdmin.filter((t) => !Boolean(t.isActive ?? true)).length})
            </button>
          </div>

          <div className="text-xs text-zinc-500">
            Mostrando <strong>{filteredTeachers.length}</strong> de <strong>{teachersAdmin.length}</strong> docentes
          </div>
        </div>

        {/* Tabla de docentes */}
        <div className="overflow-auto max-h-[32rem] border rounded">
          <table className="w-full text-xs">
            <thead className="bg-zinc-100 sticky top-0">
              <tr>
                <th className="px-2 py-1 text-center">Activo</th>
                <th className="px-2 py-1 text-left">No. empleado</th>
                <th className="px-2 py-1 text-left">Nombre</th>
                <th className="px-2 py-1 text-left">Email</th>
                <th className="px-2 py-1 text-left">Celular</th>
                <th className="px-2 py-1 text-center">FCFM</th>
                <th className="px-2 py-1 text-left">Nota</th>
                <th className="px-2 py-1 text-center">Pets/Asig</th>
                <th className="px-2 py-1 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((t) => {
                const edit = teacherEdit[t.id] || {};
                const val = (k: keyof NewTeacher, cur: string | null | undefined) => (edit[k] !== undefined ? String(edit[k]) : cur ?? "");
                const dirty = Object.keys(edit).length > 0;
                const isCurrentActive = Boolean(edit.isActive !== undefined ? edit.isActive : (t.isActive ?? true));
                return (
                  <tr key={t.id} className={`border-t transition ${!isCurrentActive ? "bg-zinc-100/70 text-zinc-500" : dirty ? "bg-amber-50" : ""}`}>
                    <td className="px-2 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={isCurrentActive}
                        onChange={(e) => {
                          const nextVal = e.target.checked;
                          setTeacherEdit((prev) => ({
                            ...prev,
                            [t.id]: { ...edit, isActive: nextVal },
                          }));
                        }}
                        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        title={isCurrentActive ? "Activo (participa en asignación)" : "Inactivo (excluido de asignación)"}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input value={val("employeeId", t.employeeId)} onChange={(e) => setTeacherEdit((prev) => ({ ...prev, [t.id]: { ...edit, employeeId: e.target.value } }))} className="w-24 border rounded px-1 py-0.5 bg-white" />
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <input value={val("name", t.name)} onChange={(e) => setTeacherEdit((prev) => ({ ...prev, [t.id]: { ...edit, name: e.target.value } }))} className="w-52 border rounded px-1 py-0.5 bg-white" />
                        {!isCurrentActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600 shrink-0">
                            Inactivo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1">{t.email}</td>
                    <td className="px-2 py-1">
                      <input value={val("phone", t.phone)} onChange={(e) => setTeacherEdit((prev) => ({ ...prev, [t.id]: { ...edit, phone: e.target.value } }))} className="w-28 border rounded px-1 py-0.5 bg-white" />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <select value={edit.affiliation !== undefined ? edit.affiliation : t.affiliation} onChange={(e) => setTeacherEdit((prev) => ({ ...prev, [t.id]: { ...edit, affiliation: e.target.value } }))} className="border rounded px-1 py-0.5 bg-white">
                        <option>Interno</option>
                        <option>Externo</option>
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input value={val("note", t.note)} onChange={(e) => setTeacherEdit((prev) => ({ ...prev, [t.id]: { ...edit, note: e.target.value } }))} className="w-full min-w-40 border rounded px-1 py-0.5 bg-white" />
                    </td>
                    <td className="px-2 py-1 text-center text-zinc-500">
                      {t._count?.petitions ?? 0}/{t._count?.assignments ?? 0}
                    </td>
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      <button onClick={() => handleSaveTeacher(t.id)} disabled={!dirty} className="mr-1 px-2 py-1 rounded bg-zinc-900 text-white disabled:opacity-40">Guardar</button>
                      <button onClick={() => handleDeleteTeacher(t.id, t.name)} className="px-2 py-1 rounded border bg-red-50 text-red-700 hover:bg-red-100">Borrar</button>
                    </td>
                  </tr>
                );
              })}
              {filteredTeachers.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-zinc-500">
                    {filterText ? "No se encontraron docentes con el criterio de búsqueda." : "Sin docentes registrados"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
