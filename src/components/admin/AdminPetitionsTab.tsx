"use client";

import React from "react";
import { AdminData, Course, Semester, AssignmentsState } from "./types";

interface AdminPetitionsTabProps {
  semesters: Semester[];
  semesterId: string;
  onSemesterIdChange: (id: string) => void;
  data: AdminData | null;
  loading: boolean;
  onReload: () => void;
  onExportCsv: () => void;
  filterTeacher: string;
  onFilterTeacherChange: (val: string) => void;
  filterCourse: string;
  onFilterCourseChange: (val: string) => void;
  courses: Course[];
  assignments: AssignmentsState | null;
}

export default function AdminPetitionsTab({
  semesters,
  semesterId,
  onSemesterIdChange,
  data,
  loading,
  onReload,
  onExportCsv,
  filterTeacher,
  onFilterTeacherChange,
  filterCourse,
  onFilterCourseChange,
  courses,
  assignments,
}: AdminPetitionsTabProps) {
  const filteredSlots = data?.slots.filter((s) => {
    if (filterTeacher) {
      const q = filterTeacher.toLowerCase();
      const match =
        s.teacher.name.toLowerCase().includes(q) ||
        s.teacher.email.toLowerCase().includes(q) ||
        (s.teacher.employeeId && s.teacher.employeeId.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (filterCourse) {
      const match = s.options.some((o) => String(o.courseId) === filterCourse);
      if (!match) return false;
    }
    return true;
  });

  const vacantCoursesCount = courses.filter(
    (c) => !assignments?.assignments.some((a) => a.courseId === c.id)
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Barra de Filtros y Acciones */}
      <div className="flex flex-wrap gap-3 items-center justify-between border border-slate-200/80 rounded-2xl p-4 bg-white shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-50/80 p-1 rounded-xl border border-slate-200/70">
            <span className="text-xs font-semibold text-slate-500 pl-1.5">Ciclo:</span>
            <select
              value={semesterId}
              onChange={(e) => onSemesterIdChange(e.target.value)}
              className="border border-slate-300/80 rounded-lg px-2.5 py-1 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs cursor-pointer"
            >
              {semesters.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.label} {s.isActive ? "● (Activo)" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onReload}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-50 transition shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <span>{loading ? "⏳" : "↻"}</span>
            <span>{loading ? "Actualizando..." : "Recargar"}</span>
          </button>

          <button
            onClick={onExportCsv}
            disabled={!data}
            className="px-3.5 py-1.5 rounded-xl border border-emerald-300/90 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 text-xs font-bold disabled:opacity-50 transition shadow-2xs cursor-pointer flex items-center gap-1.5"
          >
            <span>📥</span> Exportar CSV
          </button>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              placeholder="Buscar docente o nómina..."
              value={filterTeacher}
              onChange={(e) => onFilterTeacherChange(e.target.value)}
              className="border border-slate-300/80 rounded-xl px-3 py-1.5 text-xs w-full bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
            />
            {filterTeacher && (
              <button
                onClick={() => onFilterTeacherChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={filterCourse}
            onChange={(e) => onFilterCourseChange(e.target.value)}
            className="border border-slate-300/80 rounded-xl px-3 py-1.5 text-xs bg-slate-50/50 focus:bg-white text-slate-700 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs cursor-pointer"
          >
            <option value="">Todas las materias registradas</option>
            {data?.statsByCourse.map((s) => (
              <option key={s.courseId} value={String(s.courseId)}>
                {s.course.code} - {s.course.name} ({s.count} pet.)
              </option>
            ))}
          </select>
        </div>
      </div>

      {data && (
        <>
          {/* Indicadores Clave de Participación (KPI Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1 */}
            <div className="border border-slate-200/80 rounded-2xl p-4 bg-white shadow-xs hover:border-slate-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Docentes Participantes
                </span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                  👥
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2 tracking-tight">
                {data.totalTeachers}
                <span className="text-xs font-semibold text-slate-400 ml-1.5">profesores</span>
              </div>
              <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100 flex-wrap">
                {[1, 2, 3].map((slot) => {
                  const count = new Set(
                    data.slots.filter((s) => s.slot_no === slot).map((s) => s.teacher.id)
                  ).size;
                  return (
                    <span
                      key={slot}
                      className="px-2 py-0.5 rounded-md bg-slate-100/80 text-slate-700 text-[10px] font-semibold font-mono"
                    >
                      Slot {slot}: <b>{count}</b>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Card 2 */}
            <div className="border border-slate-200/80 rounded-2xl p-4 bg-white shadow-xs hover:border-slate-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Docentes sin Asignar
                </span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold">
                  ⚠️
                </div>
              </div>
              <div className="text-2xl font-extrabold text-amber-600 mt-2 tracking-tight">
                {(() => {
                  const assignedAll = new Set(
                    (assignments?.assignments ?? []).map((a) => a.teacherId)
                  );
                  const missingTotal = new Set(
                    data.slots
                      .filter((s) => !assignedAll.has(s.teacher.id))
                      .map((s) => s.teacher.id)
                  ).size;
                  return missingTotal;
                })()}
                <span className="text-xs font-semibold text-slate-400 ml-1.5">en cola de rescate</span>
              </div>
              <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100 flex-wrap">
                {[1, 2, 3].map((slot) => {
                  const assigned = new Set(
                    (assignments?.assignments ?? [])
                      .filter((a) => a.slotNo === slot)
                      .map((a) => a.teacherId)
                  );
                  const missing = new Set(
                    data.slots
                      .filter((s) => s.slot_no === slot && !assigned.has(s.teacher.id))
                      .map((s) => s.teacher.id)
                  );
                  return (
                    <span
                      key={slot}
                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 text-[10px] font-semibold font-mono"
                    >
                      Slot {slot}: <b>{missing.size}</b>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Card 3 */}
            <div className="border border-slate-200/80 rounded-2xl p-4 bg-white shadow-xs hover:border-slate-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Materias Vacantes
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">
                  📖
                </div>
              </div>
              <div className="text-2xl font-extrabold text-indigo-700 mt-2 tracking-tight">
                {vacantCoursesCount}
                <span className="text-xs font-semibold text-slate-400 ml-1.5">disponibles</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-3 pt-2.5 border-t border-slate-100">
                Ofertadas en el catálogo listas para asignación o rescate.
              </p>
            </div>
          </div>

          {/* Demanda Consolidada por Materia */}
          <div className="border border-slate-200/80 rounded-2xl bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <span>🔥</span> Demanda de Materias Registrada
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                {data.statsByCourse.length} cursos solicitados
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
              {data.statsByCourse
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((s) => (
                  <span
                    key={s.courseId}
                    className={`px-2.5 py-1 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
                      s.count > 3
                        ? "bg-rose-50 border-rose-200 text-rose-900"
                        : s.count > 1
                        ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                        : "bg-slate-50 border-slate-200/80 text-slate-700"
                    }`}
                  >
                    <span className="font-mono font-bold">{s.course.code}</span>
                    <span className="text-[11px] text-slate-500">
                      {s.course.dias || ""} {s.course.horario || ""}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full font-bold text-[10px] shadow-2xs ${
                        s.count > 3
                          ? "bg-rose-600 text-white"
                          : s.count > 1
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {s.count}
                    </span>
                  </span>
                ))}
              {data.statsByCourse.length === 0 && (
                <span className="text-xs text-slate-400 py-2">
                  Sin solicitudes registradas aún para este semestre.
                </span>
              )}
            </div>
          </div>

          {/* Tabla de Peticiones */}
          <div className="border border-slate-200/80 rounded-2xl bg-white overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/70 flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <span>📋</span> Peticiones Recibidas ({filteredSlots?.length || 0})
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Visualización detallada por docente
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100/70 text-slate-600 border-b border-slate-200/80">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-bold uppercase tracking-wider text-[11px]">Docente</th>
                    <th className="text-left px-4 py-2.5 font-bold uppercase tracking-wider text-[11px]">Contacto</th>
                    <th className="text-center px-4 py-2.5 font-bold uppercase tracking-wider text-[11px]">Slot</th>
                    <th className="text-left px-4 py-2.5 font-bold uppercase tracking-wider text-[11px]">Materias (Opciones & Prioridades)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSlots?.map((s, i) => (
                    <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{s.teacher.name}</span>
                          {s.teacher.isActive === false && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-600 border border-zinc-300">
                              Inactivo
                            </span>
                          )}
                        </div>
                        {s.teacher.employeeId && (
                          <span className="inline-block mt-0.5 text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.2 rounded">
                            Nómina: {s.teacher.employeeId}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="font-mono text-[11px]">{s.teacher.email}</div>
                        {s.teacher.phone && (
                          <div className="text-slate-400 text-[11px] mt-0.5">📞 {s.teacher.phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-indigo-50 font-bold font-mono text-indigo-800 border border-indigo-200/60 shadow-2xs">
                          S{s.slot_no}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {s.options
                            .slice()
                            .sort((a, b) => a.priority - b.priority)
                            .map((o) => {
                              const assigned = assignments?.assignments.some(
                                (a) => a.courseId === o.courseId && a.teacherId === s.teacher.id
                              );
                              return (
                                <span
                                  key={o.courseId}
                                  className={`px-2.5 py-1 rounded-xl border text-xs flex items-center gap-1.5 shadow-2xs transition ${
                                    assigned
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-950 font-semibold"
                                      : "border-slate-200/80 bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  <span className="font-mono font-bold text-indigo-700">
                                    {o.course.code}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    {o.course.dias || ""} {o.course.horario || ""}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded-md text-white text-[10px] font-extrabold shadow-2xs ${
                                      o.priority === 1
                                        ? "bg-rose-500"
                                        : o.priority === 2
                                        ? "bg-amber-500"
                                        : "bg-slate-500"
                                    }`}
                                  >
                                    P{o.priority}
                                  </span>
                                  {assigned && (
                                    <span className="ml-0.5 text-emerald-700 font-bold text-[11px]">
                                      ✓ Asignada
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSlots?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                        No se encontraron peticiones con los filtros especificados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl text-slate-400 text-sm shadow-xs">
          No hay solicitudes cargadas para este semestre.
        </div>
      )}
    </div>
  );
}
