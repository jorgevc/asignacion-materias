"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { escapeCsvCell } from "@/lib/csv";

type Course = { id: number; code: string; name: string; cupo: number | null; dias: string | null; horario: string | null; ubicacion: string | null };
type Teacher = { id: number; email: string; name: string };
type TeacherCourseExp = { courseCode: string; years: number };
type TeacherWithExps = Teacher & { expYears: number; exps?: TeacherCourseExp[] };
type Slot = {
  slot_no: number;
  teacher: Teacher;
  options: { courseId: number; course: Course; priority: number }[];
  createdAt: string;
};

type AdminData = {
  semesterId: number;
  totalTeachers: number;
  totalSlots: number;
  totalOptions: number;
  statsByCourse: { courseId: number; course: Course; count: number }[];
  slots: Slot[];
};

type Semester = { id: number; label: string; isActive: boolean };

const FIELD_OPTIONS = [
  { value: "", label: "-- ignorar --" },
  { value: "code", label: "code" },
  { value: "name", label: "name" },
  { value: "cupo", label: "cupo" },
  { value: "dias", label: "dias" },
  { value: "horario", label: "horario" },
  { value: "ubicacion", label: "ubicacion" },
];

export default function AdminPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState<string>("");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterCourse, setFilterCourse] = useState<string>("");
  const [filterTeacher, setFilterTeacher] = useState<string>("");

  // Import states
  const [importSemesterId, setImportSemesterId] = useState<string>("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importUrl, setImportUrl] = useState<string>("");
  const [preview, setPreview] = useState<{ headers: string[]; previewRows: string[][]; totalRows: number; suggestedMapping: Record<string, string> } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);

  // Assignment states - por slot botón
  const [assignments, setAssignments] = useState<{ total: number; assignments: Array<{ id: number; teacherId: number; courseId: number; slotNo: number; priority: number; puntaje: number; detalle: any; teacher: Teacher & { expYears: number }; course: Course }> } | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState<number | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [assignmentSort, setAssignmentSort] = useState<"default" | "curso">("default");

  const [teachersExp, setTeachersExp] = useState<Array<Teacher & { expYears: number; exps?: Array<{ courseCode: string; years: number }> }>>([]);
  const [expEdit, setExpEdit] = useState<Record<string, string>>({});
  const [expCourseEdit, setExpCourseEdit] = useState<Record<string, string>>({});
  const [empates, setEmpates] = useState<Array<{ courseId: number; courseCode: string; courseName: string; priority: number; puntaje: number; tied: Array<{ teacherId: number; teacherName: string; puntaje: number; petitionId: number }> }>>([]);
  const [reassignPick, setReassignPick] = useState<Record<number, number>>({});
  const [lastSlot, setLastSlot] = useState<number | null>(null);
  const [simulateResult, setSimulateResult] = useState<any>(null);
  const [simulateLoading, setSimulateLoading] = useState(false);


  useEffect(() => {
    fetch("/api/semesters")
      .then((r) => r.json())
      .then((d: Semester[]) => {
        setSemesters(d);
        const active = d.find((s) => s.isActive);
        const sid = active ? String(active.id) : d[0] ? String(d[0].id) : "";
        setSemesterId(sid);
        setImportSemesterId(sid);
      });
  }, []);

  const fetchAdmin = async () => {
    if (!semesterId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/petitions?semesterId=${semesterId}`);
      const j = await res.json();
      if (res.ok) setData(j);
      else setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async (sid: string) => {
    if (!sid) return;
    const res = await fetch(`/api/courses?semesterId=${sid}`);
    const j = await res.json();
    if (Array.isArray(j)) setCourses(j);
  };

  useEffect(() => {
    if (semesterId) {
      fetchAdmin();
      fetchCourses(semesterId);
    }
  }, [semesterId]);

  useEffect(() => {
    if (importSemesterId) fetchCourses(importSemesterId);
  }, [importSemesterId]);

  const fetchAssignments = async () => {
    if (!semesterId) return;
    const res = await fetch(`/api/admin/assignments?semesterId=${semesterId}`);
    const j = await res.json();
    if (res.ok) setAssignments(j);
    else setAssignments(null);
  };

  useEffect(() => {
    if (semesterId) fetchAssignments();
  }, [semesterId]);

  const handleAsignarSlot = async (slotNo: number) => {
    if (!semesterId) return;
    setAssignmentLoading(slotNo);
    setAssignmentMessage(null);
    try {
      const res = await fetch(`/api/admin/assignments/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: Number(semesterId), slotNo }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAssignmentMessage({ type: "error", text: j.error || "Error" });
        setEmpates([]);
        setLastSlot(slotNo);
        setSimulateResult(null);
      } else {
        setAssignmentMessage({ type: "ok", text: `Slot ${slotNo}: asignados ${j.asignados?.length ?? 0}, restantes ${j.cursosRestantes}${j.empates?.length ? `, empates ${j.empates.length}` : ""}` });
        setEmpates(j.empates || []);
        setLastSlot(slotNo);
        setSimulateResult(null);
        fetchAssignments();
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setAssignmentLoading(null);
    }
  };

  const handleBorrarSlot = async (slotNo?: number) => {
    if (!semesterId) return;
    const url = slotNo ? `/api/admin/assignments?semesterId=${semesterId}&slotNo=${slotNo}` : `/api/admin/assignments?semesterId=${semesterId}`;
    const res = await fetch(url, { method: "DELETE" });
    const j = await res.json();
    if (res.ok) {
      setAssignmentMessage({ type: "ok", text: `Borradas ${j.deleted} asignaciones ${slotNo ? `slot ${slotNo}` : "todas"}` });
      fetchAssignments();
    } else setAssignmentMessage({ type: "error", text: j.error });
  };

  const handleReassign = async (courseId: number, slotNo: number) => {
    const teacherId = reassignPick[courseId];
    if (!teacherId) {
      setAssignmentMessage({ type: "error", text: "Seleccione docente para reasignar" });
      return;
    }
    setAssignmentLoading(slotNo);
    try {
      const res = await fetch(`/api/admin/assignments/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: Number(semesterId), slotNo, courseId, teacherId }),
      });
      const j = await res.json();
      if (!res.ok) setAssignmentMessage({ type: "error", text: j.error });
      else {
        setAssignmentMessage({ type: "ok", text: `Reasignado curso ${courseId} a docente ${teacherId} en slot ${slotNo} - recalculado` });
        setEmpates(j.empates || []);
        setSimulateResult(null);
        fetchAssignments();
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setAssignmentLoading(null);
    }
  };

  const handleSimulate = async () => {
    if (!semesterId || !lastSlot) {
      setAssignmentMessage({ type: "error", text: "Ejecute primero Asignar Slot para obtener empates" });
      return;
    }
    const locked = Object.entries(reassignPick)
      .filter(([, teacherId]) => teacherId)
      .map(([courseId, teacherId]) => ({ courseId: Number(courseId), teacherId: Number(teacherId) }));
    if (locked.length === 0) {
      setAssignmentMessage({ type: "error", text: "Seleccione al menos un ganador para simular" });
      return;
    }
    setSimulateLoading(true);
    setAssignmentMessage(null);
    try {
      const res = await fetch(`/api/admin/assignments/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: Number(semesterId), slotNo: lastSlot, locked }),
      });
      const j = await res.json();
      if (!res.ok) setAssignmentMessage({ type: "error", text: j.error });
      else {
        setSimulateResult(j);
        setAssignmentMessage({ type: "ok", text: `Simulación slot ${lastSlot}: P1 ${j.totales.p1} P2 ${j.totales.p2} P3 ${j.totales.p3} (Δ P1 ${j.diff.p1} P2 ${j.diff.p2} P3 ${j.diff.p3})` });
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setSimulateLoading(false);
    }
  };

  const handleReassignLocked = async () => {
    if (!semesterId || !lastSlot || !simulateResult) return;
    const locked = Object.entries(reassignPick)
      .filter(([, teacherId]) => teacherId)
      .map(([courseId, teacherId]) => ({ courseId: Number(courseId), teacherId: Number(teacherId) }));
    if (locked.length === 0) {
      setAssignmentMessage({ type: "error", text: "Seleccione al menos un ganador para reasignar" });
      return;
    }
    setAssignmentLoading(lastSlot);
    try {
      const res = await fetch(`/api/admin/assignments/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: Number(semesterId), slotNo: lastSlot, locked }),
      });
      const j = await res.json();
      if (!res.ok) setAssignmentMessage({ type: "error", text: j.error });
      else {
        setAssignmentMessage({ type: "ok", text: `Slot ${lastSlot} recalculado con ${locked.length} bloqueos - asignados ${j.asignados?.length ?? 0}${j.empates?.length ? `, empates restantes ${j.empates.length}` : ""}` });
        setEmpates(j.empates || []);
        setSimulateResult(null);
        fetchAssignments();
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setAssignmentLoading(null);
    }
  };

  const fetchTeachersExp = async () => {
    if (!semesterId) return;
    const res = await fetch(`/api/admin/teachers/exp?semesterId=${semesterId}`);
    const j = await res.json();
    if (Array.isArray(j)) setTeachersExp(j);
  };

  useEffect(() => {
    if (semesterId) fetchTeachersExp();
  }, [semesterId, data]);

  const handleUpdateExp = async (email: string) => {
    const val = expEdit[email];
    if (val === undefined) return;
    const res = await fetch(`/api/admin/teachers/exp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, expYears: Number(val) }),
    });
    const j = await res.json();
    if (res.ok) {
      setAssignmentMessage({ type: "ok", text: `Exp global ${email} -> ${j.expYears}` });
      fetchTeachersExp();
      fetchAssignments();
    } else setAssignmentMessage({ type: "error", text: j.error });
  };

  const handleUpdateExpCourse = async (email: string, courseCode: string) => {
    const key = `${email}_${courseCode}`;
    const val = expCourseEdit[key];
    if (val === undefined) return;
    const res = await fetch(`/api/admin/teachers/exp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, courseCode, years: Number(val) }),
    });
    const j = await res.json();
    if (res.ok) {
      setAssignmentMessage({ type: "ok", text: `Exp ${email} / ${courseCode} -> ${j.exp.years}` });
      fetchTeachersExp();
    } else setAssignmentMessage({ type: "error", text: j.error });
  };

  const filteredSlots = data?.slots.filter((s) => {
    if (filterTeacher && !s.teacher.email.toLowerCase().includes(filterTeacher.toLowerCase()) && !s.teacher.name.toLowerCase().includes(filterTeacher.toLowerCase())) return false;
    if (filterCourse) {
      const has = s.options.some((o) => String(o.courseId) === filterCourse);
      if (!has) return false;
    }
    return true;
  });

  const exportCSV = () => {
    if (!data) return;
    const rows: string[] = ["docente_email,docente_nombre,slot_no,materia_codigo,materia_nombre,cupo,dias,horario,ubicacion,prioridad"];
    for (const s of data.slots) {
      for (const o of s.options) {
        rows.push(
          [
            s.teacher.email,
            s.teacher.name,
            s.slot_no,
            o.course.code,
            o.course.name,
            o.course.cupo ?? "",
            o.course.dias ?? "",
            o.course.horario ?? "",
            o.course.ubicacion ?? "",
            o.priority,
          ]
            .map(escapeCsvCell)
            .join(",")
        );
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peticiones_semestre_${semesterId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    setImportMessage(null);
    setPreview(null);
    if (!importFile && !importUrl.trim()) {
      setImportMessage({ type: "error", text: "Seleccione archivo o pegue URL" });
      return;
    }
    setImportLoading(true);
    try {
      let res: Response;
      if (importFile) {
        const fd = new FormData();
        fd.append("file", importFile);
        if (importUrl.trim()) fd.append("url", importUrl.trim());
        res = await fetch("/api/admin/courses/preview", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/admin/courses/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: importUrl.trim() }),
        });
      }
      const j = await res.json();
      if (!res.ok) {
        setImportMessage({ type: "error", text: j.error || "Error en preview" });
      } else {
        setPreview(j);
        setMapping(j.suggestedMapping || {});
        setImportMessage({ type: "ok", text: `Preview: ${j.totalRows} filas detectadas, ${j.headers.length} columnas` });
      }
    } catch (e) {
      setImportMessage({ type: "error", text: String(e) });
    } finally {
      setImportLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) {
      setImportMessage({ type: "error", text: "Primero haga preview" });
      return;
    }
    if (!importSemesterId) {
      setImportMessage({ type: "error", text: "Seleccione semestre destino" });
      return;
    }
    // Validate mapping has code and name
    const values = Object.values(mapping);
    if (!values.includes("code") || !values.includes("name")) {
      setImportMessage({ type: "error", text: "Mapeo debe incluir code y name (confirmación requerida)" });
      return;
    }
    setImportLoading(true);
    setImportMessage(null);
    try {
      let res: Response;
      if (importFile) {
        const fd = new FormData();
        fd.append("file", importFile);
        fd.append("mapping", JSON.stringify(mapping));
        fd.append("semesterId", importSemesterId);
        fd.append("mode", importMode);
        if (importUrl.trim()) fd.append("url", importUrl.trim());
        res = await fetch("/api/admin/courses/import", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/admin/courses/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: importUrl.trim(), mapping, semesterId: importSemesterId, mode: importMode }),
        });
      }
      const j = await res.json();
      if (!res.ok) {
        setImportMessage({ type: "error", text: j.error || "Error al importar" + (j.errors ? ` (${j.errors.length} filas con error)` : "") });
      } else {
        setImportMessage({
          type: "ok",
          text: `Importado: ${j.imported} materias. Borradas previas: ${j.deleted}. Errores: ${j.skipped}. Total filas Excel: ${j.totalRows}`,
        });
        setPreview(null);
        // refresh
        fetchCourses(importSemesterId);
        if (importSemesterId === semesterId) fetchAdmin();
      }
    } catch (e) {
      setImportMessage({ type: "error", text: String(e) });
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Administración - Peticiones</h1>
          <p className="text-sm text-zinc-600">Vista de peticiones y gestión de materias por Excel/URL.</p>
        </div>
        <Link href="/admin/teachers" className="px-4 py-2 rounded border bg-white text-sm hover:bg-zinc-50">
          Profesores →
        </Link>
      </div>

      {/* Import Section */}
      <div className="border rounded-lg bg-white p-4">
        <h2 className="font-semibold mb-3">Importar Materias desde Excel / Link</h2>
        <p className="text-xs text-zinc-600 mb-3">
          Campos a mostrar a docentes: <code>code, name, cupo, dias, horario, ubicacion</code>. El Excel debe contener esas columnas (nombres exactos). Confirme el mapeo en cada importación. <code>code</code> no es único: puede repetirse con distinto horario/ubicación.
        </p>
        <div className="grid md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="text-sm font-medium">Semestre destino *</label>
            <select value={importSemesterId} onChange={(e) => setImportSemesterId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white">
              {semesters.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.label} {s.isActive ? "(Activo)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Archivo Excel (.xlsx, .xls, .csv)</label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="w-full border rounded px-2 py-1.5 text-sm bg-white" />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium">O pegar link (SharePoint/Google Sheets/URL directa)</label>
            <input placeholder="https://..." value={importUrl} onChange={(e) => setImportUrl(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
            <p className="text-[11px] text-zinc-500 mt-1">Para SharePoint asegure link público o use ?download=1; si pide auth, descargue y suba archivo.</p>
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <button onClick={handlePreview} disabled={importLoading} className="px-4 py-2 rounded bg-zinc-900 text-white text-sm disabled:opacity-50">
            {importLoading ? "Procesando..." : "Previsualizar"}
          </button>
          <select value={importMode} onChange={(e) => setImportMode(e.target.value as "replace" | "append")} className="border rounded px-3 py-2 text-sm bg-white">
            <option value="replace">Reemplazar materias del semestre (borra previas)</option>
            <option value="append">Añadir (mantener previas, permite duplicados)</option>
          </select>
        </div>

        {importMessage && (
          <div className={`px-3 py-2 rounded text-sm mb-3 ${importMessage.type === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {importMessage.text}
          </div>
        )}

        {preview && (
          <div className="border rounded p-3 bg-zinc-50 space-y-3">
            <h3 className="font-semibold text-sm">Confirmar mapeo de columnas (obligatorio cada importación)</h3>
            <p className="text-xs text-zinc-600">Headers detectados: {preview.headers.join(" | ")}</p>
            <div className="grid md:grid-cols-3 gap-2">
              {preview.headers.map((h, idx) => (
                <div key={idx} className="flex flex-col gap-1 border rounded p-2 bg-white">
                  <span className="text-xs font-medium">Col {idx + 1}: {h || "(vacía)"}</span>
                  <select value={mapping[String(idx)] || ""} onChange={(e) => setMapping((prev) => ({ ...prev, [String(idx)]: e.target.value }))} className="border rounded px-2 py-1 text-sm bg-white">
                    {FIELD_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="overflow-auto border rounded bg-white">
              <table className="w-full text-xs">
                <thead className="bg-zinc-100">
                  <tr>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="px-2 py-1 text-left border-b">
                        {h} <span className="text-[10px] text-zinc-500">→ {mapping[String(i)] || "ignorar"}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-t">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-2 py-1 border-r">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500">Mostrando 5/{preview.totalRows} filas</p>
            <button onClick={handleImport} disabled={importLoading} className="px-4 py-2 rounded bg-green-700 text-white text-sm hover:bg-green-800 disabled:opacity-50">
              {importLoading ? "Importando..." : `Confirmar e Importar ${preview.totalRows} filas`}
            </button>
          </div>
        )}

        <div className="mt-4 border-t pt-3">
          <h3 className="font-semibold text-sm mb-2">Materias actuales en semestre seleccionado ({courses.length})</h3>
          <div className="overflow-auto max-h-64 border rounded bg-white">
            <table className="w-full text-xs">
              <thead className="bg-zinc-100 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">code</th>
                  <th className="px-2 py-1 text-left">name</th>
                  <th className="px-2 py-1 text-left">cupo</th>
                  <th className="px-2 py-1 text-left">dias</th>
                  <th className="px-2 py-1 text-left">horario</th>
                  <th className="px-2 py-1 text-left">ubicacion</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-2 py-1">{c.code}</td>
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1">{c.cupo ?? "-"}</td>
                    <td className="px-2 py-1">{c.dias ?? "-"}</td>
                    <td className="px-2 py-1">{c.horario ?? "-"}</td>
                    <td className="px-2 py-1">{c.ubicacion ?? "-"}</td>
                  </tr>
                ))}
                {courses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-zinc-500">
                      Sin materias para este semestre
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Asignación por Slot - botón por slot, no ciclo */}
      <div className="border rounded-lg bg-white p-4">
        <h2 className="font-semibold mb-2">Asignación por Slot (intra-slot, 1 curso/profesor/slot)</h2>
        <p className="text-xs text-zinc-600 mb-3">
          Asigna slot por slot con materias restantes. Slot 1 primero, luego slot 2 con restantes, luego slot 3. Flex desplazado +30 si prev flexible perdida. 1 docente = 1 curso por slot.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {[1, 2, 3].map((slot) => (
            <button key={slot} onClick={() => handleAsignarSlot(slot)} disabled={assignmentLoading !== null} className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50">
              {assignmentLoading === slot ? "Asignando..." : `Asignar Slot ${slot}`}
            </button>
          ))}
          <button onClick={() => handleBorrarSlot()} disabled={assignmentLoading !== null} className="px-4 py-2 rounded border bg-white text-sm">
            Borrar todas
          </button>
          {[1, 2, 3].map((slot) => (
            <button key={`del-${slot}`} onClick={() => handleBorrarSlot(slot)} className="px-3 py-2 rounded border bg-zinc-50 text-xs">
              Borrar Slot {slot}
            </button>
          ))}
          <button onClick={fetchAssignments} className="px-3 py-2 rounded border bg-white text-xs">
            Recargar asignaciones
          </button>
        </div>
        {assignmentMessage && (
          <div className={`px-3 py-2 rounded text-sm mb-3 ${assignmentMessage.type === "ok" ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
            {assignmentMessage.text}
          </div>
        )}
        {assignments && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-zinc-600">Ordenar por:</label>
              <select value={assignmentSort} onChange={(e) => setAssignmentSort(e.target.value as "default" | "curso")} className="border rounded px-2 py-1 text-xs bg-white">
                <option value="default">Slot / Docente</option>
                <option value="curso">Curso</option>
              </select>
            </div>
            <div className="overflow-auto border rounded bg-zinc-50 max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-zinc-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Slot</th>
                    <th className="px-2 py-1 text-left">Docente</th>
                    <th className="px-2 py-1 text-left">Curso</th>
                    <th className="px-2 py-1 text-left">Prio</th>
                    <th className="px-2 py-1 text-left">Puntaje</th>
                    <th className="px-2 py-1 text-left">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.assignments
                    .slice()
                    .sort((a, b) =>
                      assignmentSort === "curso"
                        ? a.course.code.localeCompare(b.course.code) || String(a.course.horario).localeCompare(String(b.course.horario)) || a.slotNo - b.slotNo
                        : a.slotNo - b.slotNo || a.teacher.name.localeCompare(b.teacher.name)
                    )
                    .map((a) => (
                  <tr key={a.id} className="border-t bg-white">
                    <td className="px-2 py-1 text-center">{a.slotNo}</td>
                    <td className="px-2 py-1">{a.teacher.name} ({a.teacher.email}) exp:{a.teacher.expYears}</td>
                    <td className="px-2 py-1">
                      {a.course.code} - {a.course.name} | {a.course.dias} {a.course.horario} {a.course.ubicacion}
                    </td>
                    <td className="px-2 py-1 text-center">{a.priority}</td>
                    <td className="px-2 py-1 font-mono">{a.puntaje}</td>
                    <td className="px-2 py-1 text-[10px]">{a.detalle ? `${a.detalle.base}+${a.detalle.desplazamiento}+${a.detalle.flexibilidad}+${a.detalle.experiencia}=${a.detalle.total}` : "-"}</td>
                  </tr>
                ))}
                {assignments.assignments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-zinc-500">
                      Sin asignaciones para este semestre
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-3 py-2 text-xs text-zinc-600">Total asignaciones: {assignments.total}</div>
            </div>
          </>
        )}
        {empates.length > 0 && (
          <div className="border rounded bg-amber-50 p-3 mt-3">
            <h3 className="font-semibold text-sm mb-2 text-amber-800">⚠ Empates detectados en último cálculo (slot {lastSlot}) — reasignación con recálculo bloqueado</h3>
            <p className="text-xs text-zinc-600 mb-2">Mismo puntaje entre 2+ docentes para el mismo curso. Seleccione ganador y reasigne; el slot completo se recalculará bloqueando su elección.</p>
            {empates.map((e) => (
              <div key={e.courseId} className="border rounded p-2 bg-white mb-2">
                <div className="font-medium text-sm">
                  {e.courseCode} - {e.courseName}
                  {(() => {
                    const c = courses.find((c) => c.id === e.courseId);
                    return c ? ` | ${c.dias ?? ""} ${c.horario ?? ""}` : "";
                  })()}{" "}
                  (P{e.priority} puntaje {e.puntaje})
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {e.tied.map((t) => (
                    <label key={t.teacherId} className={`px-2 py-1 rounded border text-xs cursor-pointer ${reassignPick[e.courseId] === t.teacherId ? "bg-indigo-100 border-indigo-400" : "bg-zinc-50"}`}>
                      <input type="radio" name={`empate-${e.courseId}`} checked={reassignPick[e.courseId] === t.teacherId} onChange={() => setReassignPick((prev) => ({ ...prev, [e.courseId]: t.teacherId }))} className="mr-1" />
                      {t.teacherName} (puntaje {t.puntaje})
                    </label>
                  ))}
                </div>
                <button onClick={() => handleReassign(e.courseId, lastSlot!)} disabled={assignmentLoading !== null || !reassignPick[e.courseId]} className="mt-2 mr-2 px-3 py-1 rounded bg-amber-600 text-white text-xs hover:bg-amber-700 disabled:opacity-50">
                  Reasignar y recalcular slot {lastSlot}
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              <button onClick={handleSimulate} disabled={simulateLoading || Object.keys(reassignPick).length === 0} className="px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
                {simulateLoading ? "Simulando..." : `Simular reasignación (sin guardar) - calcula P1/P2/P3`}
              </button>
              {simulateResult && (
                <button onClick={handleReassignLocked} disabled={assignmentLoading !== null} className="px-4 py-2 rounded bg-green-700 text-white text-sm hover:bg-green-800 disabled:opacity-50">
                  {assignmentLoading === lastSlot ? "Reasignando..." : "Reasignar con mismos bloqueos"}
                </button>
              )}
              <button onClick={() => { setReassignPick({}); setSimulateResult(null); }} className="px-3 py-2 rounded border bg-white text-xs">
                Limpiar selección
              </button>
            </div>
            {simulateResult && (
              <div className="border rounded bg-white p-3 mt-3">
                <h4 className="font-semibold text-sm mb-2">Resultado simulación slot {simulateResult.slotNo} (no persistido)</h4>
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div className="border rounded p-2 bg-zinc-50">
                    <div className="font-medium">Actual persistido</div>
                    <div>P1: {simulateResult.actualesTotales.p1} | P2: {simulateResult.actualesTotales.p2} | P3: {simulateResult.actualesTotales.p3} | Total: {simulateResult.actualesTotales.total}</div>
                  </div>
                  <div className="border rounded p-2 bg-blue-50">
                    <div className="font-medium">Simulado (con bloqueos)</div>
                    <div>P1: {simulateResult.totales.p1} | P2: {simulateResult.totales.p2} | P3: {simulateResult.totales.p3} | Total: {simulateResult.totales.total}</div>
                  </div>
                  <div className="border rounded p-2 bg-amber-50">
                    <div className="font-medium">Δ Diferencia</div>
                    <div>P1: {simulateResult.diff.p1 > 0 ? `+${simulateResult.diff.p1}` : simulateResult.diff.p1} | P2: {simulateResult.diff.p2 > 0 ? `+${simulateResult.diff.p2}` : simulateResult.diff.p2} | P3: {simulateResult.diff.p3 > 0 ? `+${simulateResult.diff.p3}` : simulateResult.diff.p3}</div>
                  </div>
                </div>
                <div className="text-xs text-zinc-600 mb-2">Bloqueos simulados: {simulateResult.locked.map((l: any) => `curso ${l.courseId}→doc ${l.teacherId}`).join(", ") || "ninguno"}</div>
                <div className="overflow-auto max-h-40 border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-100">
                      <tr>
                        <th className="px-2 py-1 text-left">Docente</th>
                        <th className="px-2 py-1 text-left">Curso</th>
                        <th className="px-2 py-1 text-center">Prio</th>
                        <th className="px-2 py-1 text-center">Puntaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulateResult.asignados.map((a: any, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{a.teacherName}</td>
                          <td className="px-2 py-1">{a.courseCode}</td>
                          <td className="px-2 py-1 text-center">{a.priority}</td>
                          <td className="px-2 py-1 text-center">{a.puntaje}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {simulateResult.empates?.length > 0 && <div className="text-xs text-amber-700 mt-2">Empates restantes tras simulación: {simulateResult.empates.length}</div>}
                <div className="mt-2 text-xs text-zinc-500">Para aplicar definitivamente, use Reasignar en cada empate o seleccione múltiples y use Simular → luego Reasignar con mismos bloqueos.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Experiencia docente - por curso (fix punto 3) */}
      <div className="border rounded-lg bg-white p-4">
        <h2 className="font-semibold mb-2">Experiencia por docente y curso (bono trayectoria por curso)</h2>
        <p className="text-xs text-zinc-600 mb-2">+1 por año hasta 10 <b>por código de materia</b> (ej MAT101). Si no hay registro por curso, se usa 0. Editar antes de asignar.</p>
        <div className="overflow-auto max-h-64 border rounded">
          <table className="w-full text-xs">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-2 py-1 text-left">Docente</th>
                <th className="px-2 py-1 text-left">Curso (code)</th>
                <th className="px-2 py-1 text-center">Años</th>
                <th className="px-2 py-1 text-left">Acción</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows: any[] = [];
                const courseCodesByTeacher = new Map<number, Set<string>>();
                if (data?.slots) {
                  for (const s of data.slots) {
                    for (const o of s.options) {
                      if (!courseCodesByTeacher.has(s.teacher.id)) courseCodesByTeacher.set(s.teacher.id, new Set());
                      courseCodesByTeacher.get(s.teacher.id)!.add(o.course.code);
                    }
                  }
                }
                // Para docentes sin petitions, mostrar global
                for (const t of teachersExp) {
                  const codes = courseCodesByTeacher.get(t.id);
                  if (!codes || codes.size === 0) {
                    const key = t.email;
                    rows.push(
                      <tr key={`${t.id}-global`} className="border-t bg-amber-50">
                        <td className="px-2 py-1">{t.name}</td>
                        <td className="px-2 py-1">{t.email} (global legacy)</td>
                        <td className="px-2 py-1 text-center">
                          <input type="number" min={0} max={50} value={expEdit[t.email] ?? String(t.expYears ?? 0)} onChange={(e) => setExpEdit((prev) => ({ ...prev, [t.email]: e.target.value }))} className="w-16 border rounded px-1 py-0.5 text-center" />
                        </td>
                        <td className="px-2 py-1">
                          <button onClick={() => handleUpdateExp(t.email)} className="px-2 py-1 rounded bg-zinc-900 text-white text-xs">Guardar global</button>
                        </td>
                      </tr>
                    );
                  } else {
                    for (const code of Array.from(codes)) {
                      const expEntry = (t as TeacherWithExps).exps?.find((e) => e.courseCode === code);
                      const years = expEntry?.years ?? 0;
                      const key = `${t.email}_${code}`;
                      rows.push(
                        <tr key={`${t.id}-${code}`} className="border-t">
                          <td className="px-2 py-1">{t.name}</td>
                          <td className="px-2 py-1 font-mono">{code}</td>
                          <td className="px-2 py-1 text-center">
                            <input type="number" min={0} max={50} value={expCourseEdit[key] ?? String(years)} onChange={(e) => setExpCourseEdit((prev) => ({ ...prev, [key]: e.target.value }))} className="w-16 border rounded px-1 py-0.5 text-center" />
                          </td>
                          <td className="px-2 py-1">
                            <button onClick={() => handleUpdateExpCourse(t.email, code)} className="px-2 py-1 rounded bg-indigo-600 text-white text-xs">Guardar {code}</button>
                          </td>
                        </tr>
                      );
                    }
                  }
                }
                return rows;
              })()}
              {teachersExp.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-zinc-500">
                    Sin docentes en este semestre
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">Si no hay registro por curso, se usa 0. El bono es por código, no por sección específica.</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end border rounded-lg p-4 bg-white">
        <div>
          <label className="text-sm font-medium">Semestre (peticiones)</label>
          <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)} className="border rounded px-3 py-2 text-sm bg-white">
            {semesters.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.label} {s.isActive ? "(Activo)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button onClick={fetchAdmin} disabled={loading} className="px-4 py-2 rounded bg-zinc-900 text-white text-sm">
          {loading ? "Cargando..." : "Recargar"}
        </button>
        <button onClick={exportCSV} disabled={!data} className="px-4 py-2 rounded border bg-white text-sm">
          Exportar CSV
        </button>
        <div className="ml-auto flex gap-2">
          <input placeholder="Filtrar docente (email/nombre)" value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className="border rounded px-3 py-2 text-sm w-64" />
          <select value={filterCourse} onChange={(e) => setFilterCourse(e.target.value)} className="border rounded px-3 py-2 text-sm bg-white">
            <option value="">Todas las materias</option>
            {data?.statsByCourse.map((s) => (
              <option key={s.courseId} value={String(s.courseId)}>
                {s.course.code} - {s.course.name} | {s.course.horario || ""} {s.course.ubicacion || ""} ({s.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded p-3 bg-white">
              <div className="text-xs text-zinc-500">Docentes con peticiones</div>
              <div className="text-xl font-semibold">
                {[1, 2, 3]
                  .map((slot) => `S${slot}: ${new Set(data.slots.filter((s) => s.slot_no === slot).map((s) => s.teacher.id)).size}`)
                  .join(" ")}
              </div>
            </div>
            <div className="border rounded p-3 bg-white">
              <div className="text-xs text-zinc-500">Docentes sin asignación (por slot)</div>
              <div className="text-xl font-semibold">
                {[1, 2, 3]
                  .map((slot) => {
                    const assigned = new Set((assignments?.assignments ?? []).filter((a) => a.slotNo === slot).map((a) => a.teacherId));
                    const missing = new Set(data.slots.filter((s) => s.slot_no === slot && !assigned.has(s.teacher.id)).map((s) => s.teacher.id));
                    return `S${slot}: ${missing.size}`;
                  })
                  .join(" ")}
              </div>
            </div>
            <div className="border rounded p-3 bg-white">
              <div className="text-xs text-zinc-500">Clases sin asignación (global)</div>
              <div className="text-xl font-semibold">{courses.filter((c) => !assignments?.assignments.some((a) => a.courseId === c.id)).length}</div>
            </div>
          </div>

          <div className="border rounded bg-white p-3">
            <h3 className="font-semibold mb-2 text-sm">Demanda por materia</h3>
            <div className="flex flex-wrap gap-2">
              {data.statsByCourse
                .sort((a, b) => b.count - a.count)
                .map((s) => (
                  <span key={s.courseId} className="px-2 py-1 rounded bg-zinc-100 border text-xs">
                    {s.course.code} - {s.course.dias || ""} {s.course.horario || ""} ({s.count})
                  </span>
                ))}
              {data.statsByCourse.length === 0 && <span className="text-xs text-zinc-500">Sin datos</span>}
            </div>
          </div>

          <div className="border rounded bg-white overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">Docente</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-center px-3 py-2">Slot</th>
                  <th className="text-left px-3 py-2">Materias (código - prioridad)</th>
                </tr>
              </thead>
              <tbody>
                {filteredSlots?.map((s, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{s.teacher.name}</td>
                    <td className="px-3 py-2">{s.teacher.email}</td>
                    <td className="px-3 py-2 text-center">{s.slot_no}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {s.options
                          .slice()
                          .sort((a, b) => a.priority - b.priority)
                          .map((o) => {
                            const assigned = assignments?.assignments.some((a) => a.courseId === o.courseId && a.teacherId === s.teacher.id);
                            return (
                              <span key={o.courseId} className={`px-2 py-0.5 rounded border text-xs ${assigned ? "border-green-600 bg-green-50" : "bg-zinc-50"}`}>
                                {o.course.code} - {o.course.dias || ""} {o.course.horario || ""} {o.course.ubicacion || ""}{" "}
                                <span className={`ml-1 px-1 rounded text-white ${o.priority === 1 ? "bg-red-600" : o.priority === 2 ? "bg-amber-600" : "bg-zinc-500"}`}>P{o.priority}</span>
                                {assigned && <span className="ml-1 px-1 rounded text-white bg-green-600">✓ asignada</span>}
                              </span>
                            );
                          })}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSlots?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                      No hay peticiones con ese filtro
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!data && !loading && <p className="text-sm text-zinc-500">Sin datos para este semestre.</p>}
    </main>
  );
}
