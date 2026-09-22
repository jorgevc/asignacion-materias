import React from "react";
import type { RescueAnalysisResult } from "@/lib/asignador";
import {
  AssignmentsState,
  Course,
  LastRecalculatedEvent,
  ResolvedRescueRecord,
  TieGroup,
} from "./types";

export interface AdminAssignmentTabProps {
  // Algoritmo por slot
  onAsignarSlot: (slot: number) => void;
  assignmentLoading: number | null;
  onBorrarSlot: (slotNo?: number) => void;
  assignmentMessage: { type: "ok" | "error"; text: string } | null;
  assignments: AssignmentsState | null;
  onFetchAssignments: () => void;
  onFetchRescueAnalysis: (semesterId?: string, slot?: number) => void;
  onOpenFillExcelModal: () => void;

  // Recálculo alert
  lastRecalculatedEvent: LastRecalculatedEvent | null;
  onDismissLastRecalculatedEvent: () => void;

  // Rescate
  activeRescueSlot: number;
  switchRescueSlot: (slot: number) => void;
  rescueAnalysis: RescueAnalysisResult | null;
  rescueLoading: boolean;
  resolvedRescueCases: ResolvedRescueRecord[];
  rescueTab: Record<number, "opcion1" | "opcion2" | "opcion3" | "opcion4">;
  setRescueTab: React.Dispatch<
    React.SetStateAction<Record<number, "opcion1" | "opcion2" | "opcion3" | "opcion4">>
  >;
  vistoBuenoConfirm: Record<string, boolean>;
  setVistoBuenoConfirm: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  vacantSearch: string;
  setVacantSearch: React.Dispatch<React.SetStateAction<string>>;
  handleExecuteRescue: (
    slotNo: number,
    teacherId: number,
    teacherName: string,
    optionLabel: string,
    newLocked: Array<{ courseId: number; teacherId: number }>,
    description: string
  ) => void;
  handleUndoRescue: (slotNo: number, teacherId: number) => void;
  handleResetAllRescues: (slotNo: number) => void;

  // Empates
  empates: TieGroup[];
  lastSlot: number | null;
  courses: Course[];
  reassignPick: Record<number, number>;
  setReassignPick: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  handleReassign: (courseId: number, slotNo: number) => void;
  simulateLoading: boolean;
  handleSimulate: () => void;
  simulateResult: any;
  handleReassignLocked: () => void;
  onClearSimulate: () => void;
}

export default function AdminAssignmentTab({
  onAsignarSlot,
  assignmentLoading,
  onBorrarSlot,
  assignmentMessage,
  assignments,
  onFetchAssignments,
  onFetchRescueAnalysis,
  onOpenFillExcelModal,
  lastRecalculatedEvent,
  onDismissLastRecalculatedEvent,
  activeRescueSlot,
  switchRescueSlot,
  rescueAnalysis,
  rescueLoading,
  resolvedRescueCases,
  rescueTab,
  setRescueTab,
  vistoBuenoConfirm,
  setVistoBuenoConfirm,
  vacantSearch,
  setVacantSearch,
  handleExecuteRescue,
  handleUndoRescue,
  handleResetAllRescues,
  empates,
  lastSlot,
  courses,
  reassignPick,
  setReassignPick,
  handleReassign,
  simulateLoading,
  handleSimulate,
  simulateResult,
  handleReassignLocked,
  onClearSimulate,
}: AdminAssignmentTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Barra de Ejecución de Algoritmo por Slot */}
      <div className="border border-slate-200/80 rounded-2xl bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-base shrink-0 border border-indigo-100">
              ⚡
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 tracking-tight">
                Asignación por Slot
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ejecución secuencial con protección de opciones anteriores (Bono de desplazamiento +40/+70 y flexibilidad +30).
              </p>
            </div>
          </div>
          <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-3 py-1 rounded-lg font-bold self-start sm:self-auto shadow-2xs">
            1 curso por docente por slot
          </span>
        </div>

        {/* Botones de Slot */}
        <div className="flex flex-wrap items-center gap-2">
          {[1, 2, 3].map((slot) => (
            <button
              key={slot}
              onClick={() => onAsignarSlot(slot)}
              disabled={assignmentLoading !== null}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 transition shadow-2xs cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <span>{assignmentLoading === slot ? "⏳" : "▶"}</span>
              <span>{assignmentLoading === slot ? "Calculando..." : `Asignar Slot ${slot}`}</span>
            </button>
          ))}

          <div className="h-5 w-px bg-slate-200 hidden sm:block mx-1" />

          <button
            onClick={() => onBorrarSlot()}
            disabled={assignmentLoading !== null}
            className="px-3.5 py-2 rounded-xl border border-red-200 bg-red-50/60 hover:bg-red-100 text-red-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
          >
            🗑️ Limpiar Todo
          </button>

          {[1, 2, 3].map((slot) => (
            <button
              key={`del-${slot}`}
              onClick={() => onBorrarSlot(slot)}
              disabled={assignmentLoading !== null}
              className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition cursor-pointer"
            >
              Borrar S{slot}
            </button>
          ))}

          <button
            onClick={onFetchAssignments}
            className="px-3 py-2 rounded-xl border border-slate-300/80 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-2xs cursor-pointer"
          >
            ↻ Refrescar
          </button>

          <button
            type="button"
            onClick={onOpenFillExcelModal}
            className="px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer ml-auto active:scale-95"
          >
            <span>📗</span> Rellenar Excel
          </button>
        </div>

        {assignmentMessage && (
          <div
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold ${
              assignmentMessage.type === "ok"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-950"
                : "bg-red-50 border border-red-200 text-red-950"
            }`}
          >
            {assignmentMessage.text}
          </div>
        )}

        {/* Tarjeta de Confirmación de Último Recálculo Aplicado */}
        {lastRecalculatedEvent && (
          <div className="border border-emerald-300/80 bg-gradient-to-r from-emerald-50/90 to-teal-50/40 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base">⚡</span>
                <span className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide">
                  Última Actualización Aplicada con Éxito (Slot {lastRecalculatedEvent.slotNo})
                </span>
                <span className="text-xs font-bold text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs">
                  {lastRecalculatedEvent.actionTitle}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-700 font-mono">🕒 {lastRecalculatedEvent.timestamp}</span>
                <button
                  type="button"
                  onClick={onDismissLastRecalculatedEvent}
                  className="text-emerald-700 hover:text-emerald-950 text-xs px-2 py-0.5 rounded-md hover:bg-emerald-200/60 font-bold cursor-pointer"
                  title="Cerrar notificación"
                >
                  ✕ Cerrar
                </button>
              </div>
            </div>

            {lastRecalculatedEvent.affectedTeachers.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>✅</span> Docentes recalculados y garantizados en esta acción:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {lastRecalculatedEvent.affectedTeachers.map((t) => (
                    <div key={t.teacherId} className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 mb-1">
                        <span>{t.teacherName}</span>
                        <span className="px-2 py-0.5 rounded-md text-[11px] bg-emerald-100 text-emerald-900 font-mono font-bold">
                          {t.puntaje} pts (P{t.priority})
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 font-mono">
                        Asignado a: <b className="text-indigo-900">{t.courseCode}</b> - {t.courseName}
                      </div>
                      {t.detalle && (
                        <div className="text-[11px] text-slate-600 font-mono mt-1 pt-1 border-t border-slate-100 flex flex-wrap items-center gap-1">
                          <span className="text-slate-400">Cálculo:</span>
                          <span>Base: <b>{t.detalle.base}</b></span>
                          <span>+ Despl: <b>{t.detalle.desplazamiento}</b></span>
                          <span>+ Flex: <b>{t.detalle.flexibilidad}</b></span>
                          <span>+ Exp: <b>{t.detalle.experiencia}</b></span>
                          <span className="text-emerald-700 font-bold">= {t.puntaje} pts</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-emerald-800">
                Se recalculó el Slot {lastRecalculatedEvent.slotNo} de forma consistente con los bloqueos activos.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Empates Detectados */}
      {empates.length > 0 && (
        <div className="border border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-orange-50/30 to-white rounded-2xl p-5 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2.5 text-amber-950 font-bold text-sm">
            <span className="text-base">⚠️</span>
            <span>Empates Detectados en el Último Cálculo (Slot {lastSlot})</span>
          </div>
          <p className="text-xs text-amber-900/80 leading-relaxed">
            Se detectó mismo puntaje entre dos o más docentes para la misma materia. Elige a quién favorecer y presiona <b>Reasignar</b> para continuar.
          </p>

          <div className="space-y-3">
            {empates.map((e) => (
              <div key={e.courseId} className="border border-amber-200/80 rounded-xl p-3.5 bg-white shadow-2xs">
                <div className="font-bold text-xs text-slate-900 mb-2 flex items-center justify-between">
                  <span>
                    {e.courseCode} - {e.courseName} (Prioridad {e.priority}, {e.puntaje} pts)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Clave {e.courseId}</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2.5">
                  {e.tied.map((t) => (
                    <label
                      key={t.teacherId}
                      className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer flex items-center gap-1.5 transition ${
                        reassignPick[e.courseId] === t.teacherId
                          ? "bg-indigo-50 border-indigo-500 text-indigo-900 font-bold shadow-2xs"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`empate-${e.courseId}`}
                        checked={reassignPick[e.courseId] === t.teacherId}
                        onChange={() => setReassignPick((prev) => ({ ...prev, [e.courseId]: t.teacherId }))}
                        className="accent-indigo-600"
                      />
                      <span>{t.teacherName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({t.puntaje} pts)</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => handleReassign(e.courseId, lastSlot!)}
                  disabled={assignmentLoading !== null || !reassignPick[e.courseId]}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs disabled:opacity-50 transition cursor-pointer"
                >
                  Asignar y recalcular slot {lastSlot}
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200/60">
            <button
              onClick={handleSimulate}
              disabled={simulateLoading || Object.keys(reassignPick).length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs disabled:opacity-50 transition cursor-pointer"
            >
              {simulateLoading ? "Simulando..." : "Simular reasignación (sin guardar)"}
            </button>
            {simulateResult && (
              <button
                onClick={handleReassignLocked}
                disabled={assignmentLoading !== null}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs disabled:opacity-50 transition cursor-pointer"
              >
                Aplicar simulación definitivamente
              </button>
            )}
            <button
              onClick={onClearSimulate}
              className="px-3 py-1.5 rounded-xl border border-slate-300/80 bg-white text-slate-700 text-xs hover:bg-slate-50 transition shadow-2xs cursor-pointer font-medium"
            >
              Limpiar selección
            </button>
          </div>
        </div>
      )}

      {/* 3. Módulo Secuencial de Rescate */}
      {/* Selector de Slot para Rescate de Conflictos */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <div>
              <div className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Módulo de Resolución de Conflictos (Docentes con 3 Opciones)
              </div>
              <div className="text-xs text-amber-800">
                Seleccione el slot que desea inspeccionar o resolver:
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => {
              const isCurrent = activeRescueSlot === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => switchRescueSlot(s)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isCurrent
                      ? "bg-amber-600 text-white shadow-xs ring-2 ring-amber-400"
                      : "bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                  }`}
                >
                  <span>Slot {s}</span>
                  {activeRescueSlot === s && <span className="text-[10px]">● Activo</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gestión Secuencial de Docentes con 3 Opciones (Modelo 1) */}
        {(() => {
          const currentSlot = activeRescueSlot || rescueAnalysis?.slotNo || lastSlot || 1;
          const pendingCases = (rescueAnalysis?.cases || []).filter(
            (c) => !resolvedRescueCases.some((r) => r.teacherId === c.teacherId)
          );
          const totalCasesCount = resolvedRescueCases.length + pendingCases.length;
          const progressPercent = totalCasesCount > 0 ? Math.round((resolvedRescueCases.length / totalCasesCount) * 100) : 100;

          // Si no hay casos ni resueltos ni pendientes, y hay asignaciones
          if (totalCasesCount === 0 && assignments && assignments.assignments.length > 0) {
            return (
              <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-3.5 mt-3 shadow-2xs flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">✅</span>
                  <div>
                    <div className="font-bold text-xs text-emerald-950">
                      Cobertura Completa (Slot {currentSlot})
                    </div>
                    <div className="text-xs text-emerald-800">
                      Todos los docentes que registraron sus 3 opciones reglamentarias cuentan con materia asignada en este slot.
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-200/80 text-emerald-900">
                  100% Cobertura
                </span>
              </div>
            );
          }

          if (totalCasesCount === 0) return null;

          return (
            <div className="border border-indigo-200 rounded-xl bg-gradient-to-b from-slate-50 via-white to-indigo-50/20 p-4 mt-4 shadow-sm space-y-4">
              {/* Header con avance y control de reinicio */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h3 className="font-bold text-base text-zinc-900 flex items-center gap-2">
                      <span>Resolución Secuencial: Docentes con 3 Opciones</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        Slot {currentSlot}
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      <b>Modelo Paso a Paso Reactivo:</b> Cada resolución actualiza en vivo el tablero para que los siguientes casos se resuelvan sobre la realidad vigente.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 border">
                    Avance: {resolvedRescueCases.length} de {totalCasesCount} Resueltos
                  </span>
                  {resolvedRescueCases.length > 0 && (
                    <button
                      type="button"
                      disabled={rescueLoading}
                      onClick={() => handleResetAllRescues(currentSlot)}
                      className="px-2.5 py-1 rounded text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                    >
                      ↺ Reiniciar Todo
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="w-full bg-zinc-200 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* SECCIÓN 1: Casos Resueltos (Verde con botón de Deshacer) */}
              {resolvedRescueCases.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <span>✅</span>
                    <span>Casos Resueltos ({resolvedRescueCases.length}):</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {resolvedRescueCases.map((r) => (
                      <div
                        key={r.teacherId}
                        className="border-2 border-emerald-300 rounded-xl p-3.5 bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-zinc-900">{r.teacherName}</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {r.optionLabel}
                            </span>
                            <span className="text-[10px] text-zinc-400">🕒 {r.timestamp}</span>
                          </div>
                          <div className="text-xs font-mono text-emerald-950 font-semibold">
                            Materia asegurada: <b>{r.assignedCourseSummary}</b>
                          </div>
                          <div className="text-[11px] text-zinc-600 leading-snug">
                            {r.description}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={rescueLoading}
                          onClick={() => handleUndoRescue(currentSlot, r.teacherId)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-semibold shadow-2xs transition-colors shrink-0 flex items-center gap-1.5 self-end sm:self-auto cursor-pointer"
                        >
                          <span>↩️</span>
                          <span>Deshacer Caso</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECCIÓN 2: Casos Pendientes de Resolución */}
              {pendingCases.length === 0 && resolvedRescueCases.length > 0 ? (
                <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🎉</span>
                    <div>
                      <h4 className="font-bold text-sm text-emerald-950">
                        ¡Todos los docentes con 3 opciones cuentan con materia asignada!
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Se aseguraron exitosamente {resolvedRescueCases.length} asignaciones en este slot sin conflictos de recursos.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-200 text-emerald-950 shrink-0">
                    100% Cobertura
                  </span>
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {pendingCases.length > 0 && (
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <span>🟡</span>
                      <span>
                        Siguiente Caso a Resolver ({pendingCases.length} pendiente{pendingCases.length > 1 ? "s" : ""}):
                      </span>
                    </div>
                  )}

                  {pendingCases.map((c, idx) => {
                    const currentTab = rescueTab[c.teacherId] || "opcion2";
                    return (
                      <div key={c.teacherId} className="border-2 border-amber-300 rounded-xl bg-white p-4 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 mb-3 border-b">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900">
                                Caso {resolvedRescueCases.length + idx + 1} de {totalCasesCount}
                              </span>
                              <span className="text-xs font-normal px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {c.optionsCount} opciones registradas
                              </span>
                            </div>
                            <div className="text-base font-bold text-zinc-900">
                              Docente sin asignación: {c.teacherName}
                            </div>
                          </div>
                        </div>

                        {/* SECCIÓN: Opciones registradas por el docente y su estado */}
                        {c.registeredOptions && c.registeredOptions.length > 0 && (
                          <div className="mb-4 bg-slate-50/80 border border-slate-200 rounded-xl p-3.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span>📋</span>
                                <span>Opciones solicitadas por el docente ({c.registeredOptions.length}):</span>
                              </div>
                              <span className="text-[11px] text-slate-500 italic">
                                Estado de cada solicitud en este Slot {currentSlot}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              {c.registeredOptions.map((opt) => (
                                <div
                                  key={`${opt.priority}-${opt.courseId}`}
                                  className={`border rounded-lg p-2.5 text-xs flex flex-col justify-between transition-all ${
                                    opt.statusType === "occupied_this_slot"
                                      ? "bg-amber-50/70 border-amber-300"
                                      : opt.statusType === "assigned_other_slot"
                                      ? "bg-zinc-100/90 border-zinc-300 text-zinc-600"
                                      : "bg-emerald-50/70 border-emerald-300"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-white">
                                        Prioridad {opt.priority}
                                      </span>
                                      <span className="font-mono font-bold text-zinc-800">
                                        {opt.courseCode}
                                      </span>
                                    </div>
                                    <div className="font-semibold text-zinc-900 line-clamp-1 mb-1" title={opt.courseName}>
                                      {opt.courseName}
                                    </div>
                                    <div className="text-[11px] text-zinc-500 mb-2">
                                      🕒 {opt.horario || "Horario pendiente"} {opt.dias ? `• ${opt.dias}` : ""}
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t border-zinc-200/70">
                                    {opt.statusType === "occupied_this_slot" && (
                                      <div className="text-[11px] text-amber-900 font-medium">
                                        <span className="font-semibold">⚠️ Ocupada en Slot {currentSlot}:</span>
                                        <div className="truncate" title={opt.currentHolderName}>
                                          {opt.currentHolderName} ({opt.currentHolderPuntaje} pts)
                                        </div>
                                      </div>
                                    )}
                                    {opt.statusType === "assigned_other_slot" && (
                                      <div className="text-[11px] text-zinc-700 font-medium">
                                        <span className="font-semibold">🔒 Asignada en Slot {opt.assignedSlotNo}:</span>
                                        <div className="truncate" title={opt.currentHolderName}>
                                          {opt.currentHolderName || "Asignada en slot previo"}
                                        </div>
                                      </div>
                                    )}
                                    {opt.statusType === "vacant" && (
                                      <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
                                        <span>✅</span>
                                        <span>Disponible en este slot</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tabs selector */}
                        <div className="mb-3">
                          <div className="text-xs font-bold text-zinc-700 mb-1.5 flex items-center gap-1">
                            <span>⚙️</span>
                            <span>Seleccione la Estrategia de Resolución:</span>
                          </div>
                          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border text-xs flex-wrap">
                            <button
                              type="button"
                              onClick={() => setRescueTab((prev) => ({ ...prev, [c.teacherId]: "opcion2" }))}
                              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                                currentTab === "opcion2"
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "text-zinc-600 hover:text-zinc-900"
                              }`}
                            >
                              🌟 Opción 2: Ceder el Paso {c.opcion2_cederPaso.length > 0 && `(${c.opcion2_cederPaso.length})`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRescueTab((prev) => ({ ...prev, [c.teacherId]: "opcion3" }))}
                              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                                currentTab === "opcion3"
                                  ? "bg-amber-600 text-white shadow-xs"
                                  : "text-zinc-600 hover:text-zinc-900"
                              }`}
                            >
                              ⚖️ Opción 3: Protección Universal {c.opcion3_proteccionUniversal.length > 0 && `(${c.opcion3_proteccionUniversal.length})`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRescueTab((prev) => ({ ...prev, [c.teacherId]: "opcion4" }))}
                              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                                currentTab === "opcion4"
                                  ? "bg-purple-600 text-white shadow-xs"
                                  : "text-zinc-600 hover:text-zinc-900"
                              }`}
                            >
                              🔍 Opción 4: Potenciales Opciones {c.opcion4_potenciales.length > 0 && `(${c.opcion4_potenciales.length})`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRescueTab((prev) => ({ ...prev, [c.teacherId]: "opcion1" }))}
                              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                                currentTab === "opcion1"
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : "text-zinc-600 hover:text-zinc-900"
                              }`}
                            >
                              🔒 Opción 1: Bloqueo Asistido ({c.opcion1_bloqueo.length})
                            </button>
                          </div>
                        </div>

                        {/* Tab 1: Bloqueo Asistido */}
                        {currentTab === "opcion1" && (
                          <div className="space-y-3">
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900">
                              <span className="font-semibold">Opción 1 (Desempate / Bloqueo Manual):</span> Seleccione directamente una de las materias solicitadas por el docente para bloqueársela. El algoritmo recalculará el resto de asignaciones respetando este bloqueo.
                            </div>
                            {c.opcion1_bloqueo.length === 0 ? (
                              <div className="p-4 border rounded-xl bg-amber-50/70 border-amber-300 text-xs text-amber-950 space-y-1.5">
                                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                                  <span>ℹ️</span> Materias solicitadas ya asignadas en slots previos
                                </div>
                                <p className="text-zinc-700">
                                  Las materias solicitadas por {c.teacherName} en este slot ya fueron asignadas en slots anteriores (ej. Slot 1) a otros docentes con prioridad.
                                </p>
                                <p className="font-semibold text-purple-900 pt-1">
                                  👉 Utilice la <b>Opción 4 (Materias Vacantes)</b> para asignarle un curso disponible de su área con su Visto Bueno formal.
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {c.opcion1_bloqueo.map((op1) => (
                                  <div key={op1.courseId} className="border border-zinc-200 rounded-lg p-3 bg-zinc-50 flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-sm text-zinc-900">{op1.courseCode}</span>
                                        <span className="px-1.5 py-0.5 rounded text-[11px] bg-indigo-100 text-indigo-800 font-medium">
                                          Prioridad {op1.priority}
                                        </span>
                                      </div>
                                      <div className="text-xs text-zinc-700 font-medium mb-1 line-clamp-1">{op1.courseName}</div>
                                      {op1.horario && <div className="text-[11px] text-zinc-500 mb-2">🕒 {op1.horario}</div>}

                                      <div className="border-t pt-2 mt-2 text-[11px] text-zinc-600">
                                        <span className="text-zinc-400 block mb-0.5">Ocupante actual:</span>
                                        {op1.currentHolder ? (
                                          <div className="bg-white p-1.5 rounded border border-zinc-200">
                                            <div className="font-semibold text-zinc-800">{op1.currentHolder.teacherName}</div>
                                            <div className="text-zinc-500">{op1.currentHolder.puntaje} pts • {op1.currentHolder.optionsCount} {op1.currentHolder.optionsCount === 1 ? "opción" : "opciones"} reg.</div>
                                          </div>
                                        ) : (
                                          <span className="text-emerald-600 font-medium">Disponible (Sin asignar)</span>
                                        )}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      disabled={rescueLoading}
                                      onClick={() =>
                                        handleExecuteRescue(
                                          currentSlot,
                                          c.teacherId,
                                          c.teacherName,
                                          "Opción 1: Bloqueo Asistido",
                                          [{ courseId: op1.courseId, teacherId: c.teacherId }],
                                          `Bloqueo manual de ${op1.courseCode} para ${c.teacherName}`
                                        )
                                      }
                                      className="mt-3 w-full py-1.5 px-3 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                                    >
                                      {rescueLoading ? "Aplicando..." : `🔒 Bloquear para ${c.teacherName.split(" ")[0]}`}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab 2: Ceder el Paso Pro-Cobertura */}
                        {currentTab === "opcion2" && (
                          <div className="space-y-3">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-950">
                              <span className="font-bold text-emerald-800">🌟 Opción 2: Ceder el Paso Pro-Cobertura (Altruismo Algorítmico)</span>
                              <p className="mt-0.5 text-emerald-900">
                                Reasigna de forma armónica a un docente que cuenta con opciones viables de respaldo a su segunda opción, permitiendo que <b>ambos docentes tengan materia asignada</b> (cobertura total sin dejar a nadie fuera).
                              </p>
                            </div>

                            {c.opcion2_cederPaso.length === 0 ? (
                              <div className="p-4 border rounded-xl bg-slate-50 border-slate-200 text-xs text-zinc-700 space-y-1.5 text-left">
                                <div className="font-bold flex items-center gap-1.5 text-zinc-900">
                                  <span>ℹ️</span> Sin reubicaciones viables de Ceder el Paso en este slot
                                </div>
                                <p>
                                  Los ocupantes de las materias solicitadas no disponen de materias alternas libres en este slot (sus opciones alternas ya fueron tomadas en slots previos o no registraron opciones secundarias disponibles).
                                </p>
                                <p className="text-indigo-950 font-semibold pt-1">
                                  👉 Opciones recomendadas: Use la <b>Opción 1 (Bloqueo Asistido)</b>, la <b>Opción 3 (Protección Universal)</b> si el ocupante registró menos opciones, o la <b>Opción 4 (Materias Vacantes)</b>.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {c.opcion2_cederPaso.map((op2, opIdx) => (
                                  <div key={opIdx} className="border-2 border-emerald-300 rounded-xl p-3.5 bg-gradient-to-r from-emerald-50/50 to-teal-50/30">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                      {/* Asignación 1 */}
                                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="font-bold text-emerald-800">✅ Recibe materia:</span>
                                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold">3 opciones reg.</span>
                                        </div>
                                        <div className="font-bold text-sm text-zinc-900">{c.teacherName}</div>
                                        <div className="text-xs text-zinc-600 mt-1 font-mono">
                                          Curso: <b>{op2.targetCourseCode}</b> - {op2.targetCourseName}
                                        </div>
                                      </div>

                                      {/* Asignación 2 */}
                                      <div className="bg-white p-2.5 rounded-lg border border-teal-200 shadow-2xs">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="font-bold text-teal-800">🔄 Cede y se reubica:</span>
                                          <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[11px] font-semibold">Conserva materia</span>
                                        </div>
                                        <div className="font-bold text-sm text-zinc-900">{op2.displacedTeacherName}</div>
                                        <div className="text-xs text-zinc-600 mt-1 font-mono">
                                          Alternativa: <b>{op2.alternativeCourseCode}</b> - {op2.alternativeCourseName}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-xs text-emerald-900 bg-white/80 p-2 rounded border border-emerald-100 mb-3">
                                      ℹ️ {op2.description}
                                    </div>

                                    <button
                                      type="button"
                                      disabled={rescueLoading}
                                      onClick={() =>
                                        handleExecuteRescue(
                                          currentSlot,
                                          c.teacherId,
                                          c.teacherName,
                                          "Opción 2: Ceder el Paso",
                                          op2.locked,
                                          `Ceder el paso: ${op2.displacedTeacherName} cede ${op2.targetCourseCode} a ${c.teacherName} y se reubica en ${op2.alternativeCourseCode}`
                                        )
                                      }
                                      className="w-full py-2 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                      <span>{rescueLoading ? "⏳" : "✨"}</span>
                                      <span>{rescueLoading ? "Aplicando reubicación..." : "Aplicar 'Ceder el Paso' (Garantizar Materia a Ambos)"}</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab 3: Regla de Protección Universal */}
                        {currentTab === "opcion3" && (
                          <div className="space-y-3">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-950">
                              <span className="font-bold text-amber-800">⚖️ Opción 3: Regla de Protección Universal (Penalización por Inflexibilidad)</span>
                              <p className="mt-0.5 text-amber-900">
                                Desplaza a un docente que registró <b>menos opciones reglamentarias</b> (ej. solo 1 opción), cediendo el curso al docente que cumplió con capturar sus 3 opciones. <b>El docente desplazado se quedará sin materia</b> como consecuencia de su falta de opciones.
                              </p>
                            </div>

                            {c.opcion3_proteccionUniversal.length === 0 ? (
                              <div className="p-4 border rounded-lg bg-zinc-50 text-xs text-zinc-500 text-center">
                                No se encontraron ocupantes con menos de 3 opciones en los cursos solicitados.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {c.opcion3_proteccionUniversal.map((op3, opIdx) => (
                                  <div key={opIdx} className="border-2 border-rose-300 rounded-xl p-3.5 bg-gradient-to-r from-rose-50/50 to-amber-50/30">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                      {/* Asignación que gana */}
                                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="font-bold text-emerald-800">✅ Recibe materia:</span>
                                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold">3 opciones</span>
                                        </div>
                                        <div className="font-bold text-sm text-zinc-900">{c.teacherName}</div>
                                        <div className="text-xs text-zinc-600 mt-1 font-mono">
                                          Curso asignado: <b>{op3.targetCourseCode}</b> - {op3.targetCourseName}
                                        </div>
                                      </div>

                                      {/* Docente desplazado */}
                                      <div className="bg-white p-2.5 rounded-lg border border-rose-300 shadow-2xs">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                          <span className="font-bold text-rose-700">❌ SE QUEDARÁ SIN MATERIA:</span>
                                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold">
                                            Solo {op3.displacedTeacherOptionsCount} {op3.displacedTeacherOptionsCount === 1 ? "opción" : "opciones"}
                                          </span>
                                        </div>
                                        <div className="font-bold text-sm text-zinc-900">{op3.displacedTeacherName}</div>
                                        <div className="text-xs text-rose-600 mt-1">
                                          Desplazado de: <b>{op3.targetCourseCode}</b> por falta de flexibilidad
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-xs text-rose-900 bg-rose-50/80 p-2 rounded border border-rose-200 mb-3">
                                      ⚠️ {op3.description}
                                    </div>

                                    <button
                                      type="button"
                                      disabled={rescueLoading}
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `¿Confirmar desplazamiento?\n\nEl profesor ${op3.displacedTeacherName} SE QUEDARÁ SIN MATERIA en Slot ${currentSlot} y se asignará ${op3.targetCourseCode} a ${c.teacherName}.`
                                          )
                                        ) {
                                          handleExecuteRescue(
                                            currentSlot,
                                            c.teacherId,
                                            c.teacherName,
                                            "Opción 3: Protección Universal",
                                            op3.locked,
                                            `Protección Universal: Desplazado ${op3.displacedTeacherName} (falta de opciones) en ${op3.targetCourseCode} para beneficiar a ${c.teacherName}`
                                          );
                                        }
                                      }}
                                      className="w-full py-2 px-4 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                      <span>{rescueLoading ? "⏳" : "⚖️"}</span>
                                      <span>{rescueLoading ? "Aplicando sanción..." : `Aplicar Protección Universal (Desplazar a ${op3.displacedTeacherName})`}</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab 4: Potenciales Opciones (Requiere Visto Bueno del Docente Reasignado) */}
                        {currentTab === "opcion4" && (
                          <div className="space-y-4">
                            {/* ALERTA CRÍTICA DESTACADA DE VISTO BUENO */}
                            <div className="border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 shadow-sm">
                              <div className="flex items-start gap-3">
                                <span className="text-2xl mt-0.5">⚠️</span>
                                <div>
                                  <h4 className="font-extrabold text-sm text-amber-950 uppercase tracking-wide">
                                    Alerta Obligatoria: Visto Bueno del Profesor Reasignado Requerido
                                  </h4>
                                  <p className="text-xs text-amber-900 mt-1 font-medium leading-relaxed">
                                    Esta opción analiza <b>potenciales reasignaciones y materias vacantes</b> (cambio de sección, horario alterno o materias afines por experiencia).
                                    <br />
                                    <span className="font-bold underline text-amber-950">REQUISITO INDISPENSABLE:</span> Antes de aplicar cualquiera de estas asignaciones, <b>el profesor reasignado debe dar su VISTO BUENO previo</b>. No proceda sin contar con su aceptación formal expresa.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Listado de Opciones Potenciales Detectadas */}
                            {c.opcion4_potenciales.length === 0 ? (
                              <div className="p-4 border rounded-lg bg-zinc-50 text-xs text-zinc-500 text-center">
                                No se detectaron reasignaciones automáticas directas para las materias solicitadas.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                                  Potenciales opciones detectadas por el sistema ({c.opcion4_potenciales.length}):
                                </div>
                                {c.opcion4_potenciales.map((op4, opIdx) => {
                                  const isConfirmed = !!vistoBuenoConfirm[op4.id];
                                  return (
                                    <div
                                      key={op4.id}
                                      className="border-2 border-purple-200 rounded-xl p-4 bg-gradient-to-r from-purple-50/40 via-white to-indigo-50/30 shadow-2xs hover:border-purple-300 transition-all"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-purple-100">
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-zinc-800 text-white">
                                            Alternativa {opIdx + 1} de {c.opcion4_potenciales.length}
                                          </span>
                                          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800">
                                            {op4.categoryLabel}
                                          </span>
                                        </div>
                                        <span className="text-xs font-semibold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                                          <span>⚠️ Visto bueno requerido:</span>
                                          <b className="underline">{op4.vistoBuenoTeacherName}</b>
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                        {/* Destinatario 1: El docente sin curso */}
                                        <div className="bg-white p-2.5 rounded-lg border border-purple-200 shadow-2xs">
                                          <div className="text-xs font-bold text-purple-900 mb-1">
                                            ✅ Recibe curso: {c.teacherName}
                                          </div>
                                          <div className="text-xs font-mono text-zinc-700">
                                            <b>{op4.targetCourseCode}</b> - {op4.targetCourseName}
                                            {op4.targetCourseHorario && <span className="block text-[11px] text-zinc-500 font-sans">🕒 Horario: {op4.targetCourseHorario}</span>}
                                          </div>
                                        </div>

                                        {/* Destinatario 2: Si hay docente reubicado */}
                                        {op4.reassignedTeacherName !== c.teacherName && (
                                          <div className="bg-white p-2.5 rounded-lg border border-indigo-200 shadow-2xs">
                                            <div className="text-xs font-bold text-indigo-900 mb-1">
                                              🔄 Se reubica: {op4.reassignedTeacherName}
                                            </div>
                                            <div className="text-xs font-mono text-zinc-700">
                                              <b>{op4.destinationCourseCode}</b> - {op4.destinationCourseName}
                                              {op4.destinationCourseHorario && <span className="block text-[11px] text-zinc-500 font-sans">🕒 Horario: {op4.destinationCourseHorario}</span>}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Alerta contextual específica de visto bueno */}
                                      <div className="border border-amber-300 bg-amber-50/90 rounded-lg p-2.5 mb-3 text-xs text-amber-950">
                                        <div className="font-bold text-amber-900 mb-0.5">{op4.alertVistoBueno}</div>
                                        <div className="text-[11px] text-zinc-700">
                                          {op4.description}
                                        </div>
                                      </div>

                                      {/* Checkbox de confirmación obligatoria */}
                                      <div className="bg-white border-2 border-amber-200 rounded-lg p-2.5 mb-3">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-800 select-none">
                                          <input
                                            type="checkbox"
                                            checked={isConfirmed}
                                            onChange={(e) =>
                                              setVistoBuenoConfirm((prev) => ({
                                                ...prev,
                                                [op4.id]: e.target.checked,
                                              }))
                                            }
                                            className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500"
                                          />
                                          <span>
                                            Confirmo que el profesor <u className="font-bold text-purple-900">{op4.vistoBuenoTeacherName}</u> ha otorgado su <b>VISTO BUENO</b> formal para esta reasignación.
                                          </span>
                                        </label>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={rescueLoading || !isConfirmed}
                                        onClick={() =>
                                          handleExecuteRescue(
                                            currentSlot,
                                            c.teacherId,
                                            c.teacherName,
                                            "Opción 4: Potencial con Visto Bueno",
                                            op4.locked,
                                            `Opción 4 (Visto Bueno): ${op4.description}`
                                          )
                                        }
                                        className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 ${
                                          isConfirmed
                                            ? "bg-purple-700 hover:bg-purple-800 text-white cursor-pointer"
                                            : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                                        }`}
                                      >
                                        <span>{rescueLoading ? "⏳" : "🤝"}</span>
                                        <span>
                                          {rescueLoading
                                            ? "Aplicando reasignación..."
                                            : isConfirmed
                                            ? `Aplicar Reasignación (Visto Bueno de ${op4.vistoBuenoTeacherName.split(" ")[0]} Confirmado)`
                                            : "Marque la casilla de Visto Bueno para habilitar este botón"}
                                        </span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Explorador de Materias Vacantes del Slot */}
                            {rescueAnalysis?.vacantCourses && rescueAnalysis.vacantCourses.length > 0 && (
                              <div className="border border-zinc-200 rounded-xl bg-zinc-50/80 p-4 mt-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                  <div>
                                    <h5 className="font-bold text-xs text-zinc-900 uppercase tracking-wider">
                                      Explorador de Materias Vacantes en Slot {currentSlot} ({rescueAnalysis.vacantCourses.length} disponibles)
                                    </h5>
                                    <p className="text-[11px] text-zinc-600">
                                      Puede ofertar cualquiera de estas materias vacantes directamente a {c.teacherName}.
                                    </p>
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="Filtrar por código o nombre..."
                                    value={vacantSearch}
                                    onChange={(e) => setVacantSearch(e.target.value)}
                                    className="border rounded-md px-2.5 py-1 text-xs bg-white w-full sm:w-60"
                                  />
                                </div>

                                <div className="max-h-60 overflow-y-auto border rounded-lg bg-white divide-y">
                                  {rescueAnalysis.vacantCourses
                                    .filter(
                                      (vc) =>
                                        !vacantSearch ||
                                        vc.code.toLowerCase().includes(vacantSearch.toLowerCase()) ||
                                        vc.name.toLowerCase().includes(vacantSearch.toLowerCase())
                                    )
                                    .map((vc) => {
                                      const customKey = `custom-vacant-${c.teacherId}-${vc.id}`;
                                      const isCustomConfirmed = !!vistoBuenoConfirm[customKey];
                                      return (
                                        <div key={vc.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-zinc-50">
                                          <div>
                                            <div className="font-bold text-xs text-zinc-900">
                                              {vc.code} - {vc.name}
                                            </div>
                                            <div className="text-[11px] text-zinc-500 font-mono">
                                              {vc.dias ?? ""} {vc.horario ?? ""} | Ubicación: {vc.ubicacion ?? "Sin aula"} | Cupo: {vc.cupo ?? "N/A"}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-3 shrink-0">
                                            <label className="flex items-center gap-1.5 text-[11px] text-zinc-700 cursor-pointer select-none">
                                              <input
                                                type="checkbox"
                                                checked={isCustomConfirmed}
                                                onChange={(e) =>
                                                  setVistoBuenoConfirm((prev) => ({
                                                    ...prev,
                                                    [customKey]: e.target.checked,
                                                  }))
                                                }
                                                className="h-3.5 w-3.5 rounded text-purple-600"
                                              />
                                              <span>Visto bueno de {c.teacherName.split(" ")[0]}</span>
                                            </label>

                                            <button
                                              type="button"
                                              disabled={rescueLoading || !isCustomConfirmed}
                                              onClick={() =>
                                                handleExecuteRescue(
                                                  currentSlot,
                                                  c.teacherId,
                                                  c.teacherName,
                                                  "Opción 4: Materia Vacante Asignada",
                                                  [{ courseId: vc.id, teacherId: c.teacherId }],
                                                  `Asignación vacante acordada: ${vc.code} (${vc.name}) para ${c.teacherName}`
                                                )
                                              }
                                              className={`py-1 px-3 rounded text-xs font-semibold transition-all ${
                                                isCustomConfirmed
                                                  ? "bg-purple-700 hover:bg-purple-800 text-white cursor-pointer"
                                                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                                              }`}
                                            >
                                              Asignar Vacante
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
        
    </div>
  );
}
