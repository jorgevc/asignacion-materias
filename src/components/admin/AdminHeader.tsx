"use client";

import React from "react";
import Link from "next/link";
import { Semester } from "./types";

export type AdminTab = "setup" | "petitions" | "assignment" | "results";

interface AdminHeaderProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  semesters: Semester[];
  activeSelectId: string;
  onActiveSelectChange: (id: string) => void;
  onActivateSemester: (id: number) => void;
  activatingSemester: boolean;
  onOpenNewSemesterModal: () => void;
  coursesCount?: number;
  petitionsCount?: number;
  empatesCount?: number;
  assignmentsCount?: number;
}

export default function AdminHeader({
  activeTab,
  onTabChange,
  semesters,
  activeSelectId,
  onActiveSelectChange,
  onActivateSemester,
  activatingSemester,
  onOpenNewSemesterModal,
  coursesCount = 0,
  petitionsCount = 0,
  empatesCount = 0,
  assignmentsCount = 0,
}: AdminHeaderProps) {
  const currentActive = semesters.find((s) => s.isActive);

  return (
    <div className="space-y-4">
      {/* Título y Enlaces de Acceso Rápido */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              Panel Administrativo
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 font-medium">Ciclo Académico</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Asignación de Cursos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Oferta docente, peticiones, algoritmo de prioridades y resolución de vacantes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/admin/teachers"
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:border-slate-300 hover:bg-slate-50 transition shadow-2xs flex items-center gap-1.5"
          >
            <span>👥</span> Padrón Docente
          </Link>
          <Link
            href="/"
            target="_blank"
            className="px-3.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-900 text-xs font-semibold hover:bg-indigo-100/80 transition shadow-2xs flex items-center gap-1.5"
            title="Abrir formulario de profesores en pestaña nueva"
          >
            <span>🔗</span> Vista Docente
          </Link>
        </div>
      </div>

      {/* Barra de Gestión de Semestre Activo */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 border border-indigo-200/60 flex items-center justify-center text-indigo-600 text-lg font-bold shrink-0 shadow-2xs">
              🗓️
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Semestre Activo:
                </span>
                {currentActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200/80 shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {currentActive.label}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Sin ciclo activo
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Las solicitudes docentes y el cálculo algorítmico operan sobre este ciclo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50/80 p-1 rounded-xl border border-slate-200/80">
              <label className="text-xs font-medium text-slate-600 pl-1.5">Activar:</label>
              <select
                value={activeSelectId}
                onChange={(e) => onActiveSelectChange(e.target.value)}
                className="border border-slate-300/80 rounded-lg px-2.5 py-1 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-2xs"
              >
                {semesters.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.label} {s.isActive ? "● (Activo)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onActivateSemester(Number(activeSelectId))}
                disabled={
                  activatingSemester ||
                  !activeSelectId ||
                  semesters.find((s) => s.id === Number(activeSelectId))?.isActive
                }
                className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-2xs"
              >
                {activatingSemester ? "Guardando..." : "Establecer"}
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden md:block" />

            <button
              type="button"
              onClick={onOpenNewSemesterModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-indigo-100/50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:from-indigo-100 hover:to-indigo-200/60 transition shadow-2xs cursor-pointer active:scale-95"
            >
              <span>➕</span> Nuevo Semestre
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Navegación por Fases (Segmented Control Elegante) */}
      <nav className="p-1.5 bg-slate-200/60 backdrop-blur-xs rounded-2xl border border-slate-200/80 grid grid-cols-2 md:grid-cols-4 gap-1.5 shadow-inner">
        <button
          type="button"
          onClick={() => onTabChange("setup")}
          className={`flex items-center justify-center sm:justify-start gap-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "setup"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              activeTab === "setup" ? "bg-indigo-100/80 text-indigo-700" : "bg-slate-200/70 text-slate-600"
            }`}
          >
            ⚙️
          </div>
          <span className="truncate">1. Oferta & Materias</span>
          {coursesCount > 0 && (
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === "setup"
                  ? "bg-indigo-100 text-indigo-800"
                  : "bg-slate-200/80 text-slate-600"
              }`}
            >
              {coursesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange("petitions")}
          className={`flex items-center justify-center sm:justify-start gap-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "petitions"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              activeTab === "petitions" ? "bg-indigo-100/80 text-indigo-700" : "bg-slate-200/70 text-slate-600"
            }`}
          >
            📋
          </div>
          <span className="truncate">2. Peticiones Docentes</span>
          {petitionsCount > 0 && (
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === "petitions"
                  ? "bg-indigo-100 text-indigo-800"
                  : "bg-slate-200/80 text-slate-600"
              }`}
            >
              {petitionsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange("assignment")}
          className={`flex items-center justify-center sm:justify-start gap-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "assignment"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              activeTab === "assignment" ? "bg-indigo-100/80 text-indigo-700" : "bg-slate-200/70 text-slate-600"
            }`}
          >
            ⚡
          </div>
          <span className="truncate">3. Asignación & Rescate</span>
          {empatesCount > 0 && (
            <span className="ml-auto rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[10px] font-bold animate-pulse">
              ⚠ {empatesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange("results")}
          className={`flex items-center justify-center sm:justify-start gap-2.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === "results"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              activeTab === "results" ? "bg-indigo-100/80 text-indigo-700" : "bg-slate-200/70 text-slate-600"
            }`}
          >
            📊
          </div>
          <span className="truncate">4. Resultados & Excel</span>
          {assignmentsCount > 0 && (
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === "results"
                  ? "bg-indigo-100 text-indigo-800"
                  : "bg-slate-200/80 text-slate-600"
              }`}
            >
              {assignmentsCount}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
}
