"use client";

import React, { useState } from "react";
import { AssignmentsState, Course, LastRecalculatedEvent } from "./types";

interface AdminResultsTabProps {
  assignments: AssignmentsState | null;
  assignmentSlotFilter: "all" | 1 | 2 | 3;
  onAssignmentSlotFilterChange: (slot: "all" | 1 | 2 | 3) => void;
  assignmentSort: "default" | "curso";
  onAssignmentSortChange: (sort: "default" | "curso") => void;
  courses: Course[];
  lastRecalculatedEvent: LastRecalculatedEvent | null;
  onOpenFillExcelModal: () => void;
  onReloadAssignments: () => void;
}

export default function AdminResultsTab({
  assignments,
  assignmentSlotFilter,
  onAssignmentSlotFilterChange,
  assignmentSort,
  onAssignmentSortChange,
  courses,
  lastRecalculatedEvent,
  onOpenFillExcelModal,
  onReloadAssignments,
}: AdminResultsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAssignments = (assignments?.assignments ?? []).filter((a) => {
    if (assignmentSlotFilter !== "all" && a.slotNo !== assignmentSlotFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        a.teacher.name.toLowerCase().includes(q) ||
        a.course.code.toLowerCase().includes(q) ||
        a.course.name.toLowerCase().includes(q) ||
        (a.course.horario && a.course.horario.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const sortedAssignments = filteredAssignments.slice().sort((a, b) => {
    if (assignmentSort === "curso") {
      return (
        a.course.code.localeCompare(b.course.code) ||
        String(a.course.horario).localeCompare(String(b.course.horario)) ||
        a.slotNo - b.slotNo
      );
    }
    return a.slotNo - b.slotNo || a.teacher.name.localeCompare(b.teacher.name);
  });

  // Cursos vacantes (sin asignación alguna)
  const assignedCourseIds = new Set((assignments?.assignments ?? []).map((a) => a.courseId));
  const vacantCourses = courses.filter((c) => !assignedCourseIds.has(c.id));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner Destacado de Entrega y Excel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-emerald-300/80 bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg font-bold shrink-0 shadow-2xs border border-emerald-200/80">
            📊
          </div>
          <div>
            <h2 className="font-extrabold text-base text-emerald-950 tracking-tight">
              Resultados Consolidados & Entrega Oficial
            </h2>
            <p className="text-xs text-emerald-800/90 mt-0.5 max-w-xl">
              Audita las asignaciones definitivas calculadas por mérito, consulta cursos vacantes y descarga el archivo oficial con la programación académica final.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={onReloadAssignments}
            className="px-3.5 py-2 rounded-xl border border-slate-300/80 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            ↻ Actualizar
          </button>

          <button
            type="button"
            onClick={onOpenFillExcelModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white text-xs font-bold shadow-xs hover:shadow transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <span>📗</span> Llenar y Descargar Excel Oficial
          </button>
        </div>
      </div>

      {assignments ? (
        <div className="border border-slate-200/80 rounded-2xl bg-white p-5 shadow-xs space-y-4">
          {/* Barra de Filtros y Búsqueda */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70">
              <span className="text-xs font-bold text-slate-500 pl-1.5 pr-1">Slot:</span>
              {(["all", 1, 2, 3] as const).map((s) => {
                const count =
                  s === "all"
                    ? assignments.assignments.length
                    : assignments.assignments.filter((a) => a.slotNo === s).length;
                const isActive = assignmentSlotFilter === s;
                return (
                  <button
                    key={String(s)}
                    type="button"
                    onClick={() => onAssignmentSlotFilterChange(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? "bg-white text-slate-900 shadow-xs font-extrabold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    }`}
                  >
                    {s === "all" ? "Todos" : `S${s}`} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                placeholder="Buscar profesor o materia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-slate-300/80 rounded-xl px-3 py-1.5 text-xs w-48 sm:w-64 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition"
              />
              <select
                value={assignmentSort}
                onChange={(e) => onAssignmentSortChange(e.target.value as "default" | "curso")}
                className="border border-slate-300/80 rounded-xl px-3 py-1.5 text-xs bg-slate-50/50 focus:bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs cursor-pointer"
              >
                <option value="default">Ordenar por Docente</option>
                <option value="curso">Ordenar por Clave de Curso</option>
              </select>
            </div>
          </div>

          {/* Tarjetas de Resumen Numérico */}
          {(() => {
            const currentList = assignments.assignments.filter(
              (a) => assignmentSlotFilter === "all" || a.slotNo === assignmentSlotFilter
            );
            const p1 = currentList.filter((a) => a.priority === 1).length;
            const p2 = currentList.filter((a) => a.priority === 2).length;
            const p3 = currentList.filter((a) => a.priority === 3).length;
            const avg = currentList.length
              ? Math.round(currentList.reduce((s, a) => s + a.puntaje, 0) / currentList.length)
              : 0;

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 text-center">
                <div className="border-r last:border-0 border-slate-200/80 px-2">
                  <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    Total Asignados ({assignmentSlotFilter !== "all" ? `Slot ${assignmentSlotFilter}` : "Todos"})
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-0.5">{currentList.length}</div>
                </div>

                <div className="border-r last:border-0 border-slate-200/80 px-2">
                  <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    Distribución Prioridades
                  </div>
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5 mt-1.5">
                    <span className="text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-md">P1: {p1}</span>
                    <span className="text-indigo-800 bg-indigo-100/90 border border-indigo-200 px-2 py-0.5 rounded-md">P2: {p2}</span>
                    <span className="text-amber-800 bg-amber-100/90 border border-amber-200 px-2 py-0.5 rounded-md">P3: {p3}</span>
                  </div>
                </div>

                <div className="border-r last:border-0 border-slate-200/80 px-2">
                  <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    Puntaje Promedio
                  </div>
                  <div className="text-2xl font-extrabold text-indigo-700 mt-0.5">
                    {avg} <span className="text-xs text-slate-400 font-normal">pts</span>
                  </div>
                </div>

                <div className="px-2">
                  <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    Cursos Vacantes
                  </div>
                  <div className="text-2xl font-extrabold text-amber-600 mt-0.5">{vacantCourses.length}</div>
                </div>
              </div>
            );
          })()}

          {/* Tabla de Asignaciones */}
          <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white max-h-96 shadow-xs">
            <table className="w-full text-xs">
              <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200/80 text-slate-600 z-10 backdrop-blur-xs">
                <tr>
                  <th className="px-4 py-2.5 text-center font-bold uppercase tracking-wider text-[11px]">Slot</th>
                  <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wider text-[11px]">Docente</th>
                  <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wider text-[11px]">Curso Asignado</th>
                  <th className="px-4 py-2.5 text-center font-bold uppercase tracking-wider text-[11px]">Prioridad</th>
                  <th className="px-4 py-2.5 text-center font-bold uppercase tracking-wider text-[11px]">Puntaje</th>
                  <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wider text-[11px]">Desglose de Mérito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedAssignments.map((a) => {
                  const isRecentlyAffected = lastRecalculatedEvent?.affectedTeachers.some(
                    (t) => t.teacherId === a.teacherId
                  );
                  return (
                    <tr
                      key={a.id}
                      className={`transition-colors ${
                        isRecentlyAffected
                          ? "bg-emerald-50/90 font-medium"
                          : "hover:bg-indigo-50/20"
                      }`}
                    >
                      <td className="px-4 py-2.5 text-center font-bold font-mono text-indigo-700">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/60">
                          S{a.slotNo}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{a.teacher.name}</span>
                          {isRecentlyAffected && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-950 font-bold">
                              ⚡ Recién ajustado
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {a.teacher.email} · Exp: <b>{a.teacher.expPeriods ?? a.teacher.expYears ?? 0}</b> periodos
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <span className="font-mono font-bold text-indigo-700">{a.course.code}</span>
                          <span>·</span>
                          <span>{a.course.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {a.course.dias} {a.course.horario} • {a.course.ubicacion || "Aula asignada"}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold shadow-2xs ${
                            a.priority === 1
                              ? "bg-rose-500 text-white"
                              : a.priority === 2
                              ? "bg-amber-500 text-white"
                              : "bg-slate-500 text-white"
                          }`}
                        >
                          P{a.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-extrabold text-slate-900 text-sm">
                        {a.puntaje}
                      </td>
                      <td className="px-4 py-2.5 text-[11px] font-mono text-slate-600">
                        {a.detalle ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">Base: <b>{a.detalle.base}</b></span>
                            <span className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-800">+Despl: <b>{a.detalle.desplazamiento}</b></span>
                            <span className="bg-purple-50 px-1.5 py-0.5 rounded text-purple-800">+Flex: <b>{a.detalle.flexibilidad}</b></span>
                            <span className="bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-800">+Exp: <b>{a.detalle.experiencia}</b></span>
                            <span className="font-bold text-slate-900">= {a.detalle.total} pts</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {sortedAssignments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No hay asignaciones para el filtro seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sección de Cursos Vacantes */}
          <div className="border border-amber-200/80 bg-gradient-to-r from-amber-50/50 via-white to-amber-50/30 rounded-2xl p-4 space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-amber-950 flex items-center gap-2">
                <span>⚠️</span> Materias Vacantes en el Semestre ({vacantCourses.length})
              </h3>
              <span className="text-[11px] text-amber-800 font-medium">
                Ofertadas que no recibieron asignación
              </span>
            </div>

            <div className="overflow-x-auto border border-amber-200/80 rounded-xl bg-white max-h-48 shadow-2xs">
              <table className="w-full text-xs">
                <thead className="bg-amber-50/80 text-amber-950 border-b border-amber-200/80">
                  <tr>
                    <th className="px-3.5 py-2 text-left font-bold uppercase tracking-wider text-[10px]">Clave</th>
                    <th className="px-3.5 py-2 text-left font-bold uppercase tracking-wider text-[10px]">Materia</th>
                    <th className="px-3.5 py-2 text-left font-bold uppercase tracking-wider text-[10px]">Días & Horario</th>
                    <th className="px-3.5 py-2 text-left font-bold uppercase tracking-wider text-[10px]">Ubicación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {vacantCourses.map((c) => (
                    <tr key={c.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-3.5 py-2 font-mono font-bold text-amber-900">{c.code}</td>
                      <td className="px-3.5 py-2 font-medium text-slate-900">{c.name}</td>
                      <td className="px-3.5 py-2 text-slate-600">
                        {c.dias} {c.horario}
                      </td>
                      <td className="px-3.5 py-2 text-slate-500">{c.ubicacion || "Aula s/n"}</td>
                    </tr>
                  ))}
                  {vacantCourses.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-5 text-center text-slate-400">
                        No hay materias vacantes. Todos los cursos fueron asignados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl text-slate-400 text-sm shadow-xs">
          No hay asignaciones calculadas para este semestre. Dirígete a la pestaña <b>⚡ 3. Asignación & Rescate</b> para calcular los slots.
        </div>
      )}
    </div>
  );
}
