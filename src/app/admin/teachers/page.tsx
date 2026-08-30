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
  note: string | null;
  _count?: { petitions: number; assignments: number };
};
type NewTeacher = { name: string; email: string; employeeId: string; phone: string; affiliation: string; note: string };

const EMPTY_NEW: NewTeacher = { name: "", email: "", employeeId: "", phone: "", affiliation: "Interno", note: "" };

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profesores ({teachersAdmin.length})</h1>
        <p className="text-sm text-zinc-600">
          <Link href="/admin" className="text-indigo-600 hover:underline">← Volver al panel de administración</Link>
        </p>
      </div>

      <div className="border rounded-lg bg-white p-4">
        <p className="text-xs text-zinc-600 mb-3">Alta y edición de docentes: No. de empleado único, celular opcional, interno/externo a FCFM y nota.</p>
        {teachersMsg && (
          <div className={`px-3 py-2 rounded text-sm mb-3 ${teachersMsg.type === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {teachersMsg.text}
          </div>
        )}
        {/* Alta de docente */}
        <div className="flex flex-wrap items-end gap-2 mb-4 pb-3 border-b">
          <div>
            <label className="text-xs font-medium block">No. empleado *</label>
            <input value={newTeacher.employeeId} onChange={(e) => setNewTeacher((p) => ({ ...p, employeeId: e.target.value }))} className="w-28 border rounded px-2 py-1.5 text-sm" placeholder="COL123456" />
          </div>
          <div>
            <label className="text-xs font-medium block">Nombre *</label>
            <input value={newTeacher.name} onChange={(e) => setNewTeacher((p) => ({ ...p, name: e.target.value }))} className="w-52 border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium block">Email *</label>
            <input value={newTeacher.email} onChange={(e) => setNewTeacher((p) => ({ ...p, email: e.target.value }))} className="w-56 border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium block">Celular</label>
            <input value={newTeacher.phone} onChange={(e) => setNewTeacher((p) => ({ ...p, phone: e.target.value }))} className="w-32 border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium block">Adscripción</label>
            <select value={newTeacher.affiliation} onChange={(e) => setNewTeacher((p) => ({ ...p, affiliation: e.target.value }))} className="border rounded px-2 py-1.5 text-sm bg-white">
              <option>Interno</option>
              <option>Externo</option>
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="text-xs font-medium block">Nota</label>
            <input value={newTeacher.note} onChange={(e) => setNewTeacher((p) => ({ ...p, note: e.target.value }))} className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <button onClick={handleCreateTeacher} disabled={!newTeacher.name || !newTeacher.email || !newTeacher.employeeId} className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
            Agregar
          </button>
        </div>
        {/* Tabla de docentes */}
        <div className="overflow-auto max-h-[32rem] border rounded">
          <table className="w-full text-xs">
            <thead className="bg-zinc-100 sticky top-0">
              <tr>
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
              {teachersAdmin.map((t) => {
                const edit = teacherEdit[t.id] || {};
                const val = (k: keyof NewTeacher, cur: string | null) => (edit[k] !== undefined ? String(edit[k]) : cur ?? "");
                const dirty = Object.keys(edit).length > 0;
                return (
                  <tr key={t.id} className={`border-t ${dirty ? "bg-amber-50" : ""}`}>
                    <td className="px-2 py-1">
                      <input value={val("employeeId", t.employeeId)} onChange={(e) => setTeacherEdit((prev) => ({ ...prev, [t.id]: { ...edit, employeeId: e.target.value } }))} className="w-24 border rounded px-1 py-0.5" />
                    </td>
                    <td className="px-2 py-1">
                      <input value={val("name", t.name)} onChange={(e) => setTeacherEdit((prev) => ({ ...prev, [t.id]: { ...edit, name: e.target.value } }))} className="w-52 border rounded px-1 py-0.5" />
                    </td>
                    <td className="px-2 py-1">{t.email}</td>
                    <td className="px-2 py-1">
                      <input value={val("phone", t.phone)} onChange={(e) => setTeacherEdit((prev) => ({ ...prev, [t.id]: { ...edit, phone: e.target.value } }))} className="w-28 border rounded px-1 py-0.5" />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <select value={edit.affiliation !== undefined ? edit.affiliation : t.affiliation} onChange={(e) => setTeacherEdit((prev) => ({ ...prev, [t.id]: { ...edit, affiliation: e.target.value } }))} className="border rounded px-1 py-0.5 bg-white">
                        <option>Interno</option>
                        <option>Externo</option>
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input value={val("note", t.note)} onChange={(e) => setTeacherEdit((prev) => ({ ...prev, [t.id]: { ...edit, note: e.target.value } }))} className="w-full min-w-40 border rounded px-1 py-0.5" />
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
              {teachersAdmin.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-zinc-500">Sin docentes registrados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
