"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Course,
  Semester,
  AdminData,
  TeacherWithExps,
  HistoricalFile,
  FIELD_OPTIONS,
} from "./types";

interface AdminSetupTabProps {
  semesters: Semester[];
  importSemesterId: string;
  onImportSemesterIdChange: (id: string) => void;
  importFile: File | null;
  onImportFileChange: (file: File | null) => void;
  importUrl: string;
  onImportUrlChange: (url: string) => void;
  importMode: "replace" | "append";
  onImportModeChange: (mode: "replace" | "append") => void;
  importLoading: boolean;
  importMessage: { type: "ok" | "error"; text: string } | null;
  preview: {
    headers: string[];
    previewRows: string[][];
    totalRows: number;
    suggestedMapping: Record<string, string>;
  } | null;
  mapping: Record<string, string>;
  setMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onPreview: () => void;
  onImport: () => void;
  courses: Course[];
  data: AdminData | null;
  teachersExp: TeacherWithExps[];
  historicalFiles: HistoricalFile[];
  showFilesDrawer: boolean;
  onToggleFilesDrawer: () => void;
  fileUploadLoading: boolean;
  fileMessage: { type: "ok" | "error"; text: string } | null;
  onDismissFileMessage: () => void;
  onUploadHistoricalFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteHistoricalFile: (filename: string) => void;
  onImportHistory: () => void;
  importHistoryLoading: boolean;
  expEdit: Record<string, string>;
  onExpEditChange: (email: string, val: string) => void;
  expCourseEdit: Record<string, string>;
  onExpCourseEditChange: (key: string, val: string) => void;
  onUpdateExp: (email: string) => void;
  onUpdateExpCourse: (email: string, courseCode: string) => void;
}

export default function AdminSetupTab({
  semesters,
  importSemesterId,
  onImportSemesterIdChange,
  importFile,
  onImportFileChange,
  importUrl,
  onImportUrlChange,
  importMode,
  onImportModeChange,
  importLoading,
  importMessage,
  preview,
  mapping,
  setMapping,
  onPreview,
  onImport,
  courses,
  data,
  teachersExp,
  historicalFiles,
  showFilesDrawer,
  onToggleFilesDrawer,
  fileUploadLoading,
  fileMessage,
  onDismissFileMessage,
  onUploadHistoricalFile,
  onDeleteHistoricalFile,
  onImportHistory,
  importHistoryLoading,
  expEdit,
  onExpEditChange,
  expCourseEdit,
  onExpCourseEditChange,
  onUpdateExp,
  onUpdateExpCourse,
}: AdminSetupTabProps) {
  const [courseSearch, setCourseSearch] = useState("");
  const [expSearch, setExpSearch] = useState("");

  const filteredCourses = courses.filter((c) => {
    if (!courseSearch) return true;
    const q = courseSearch.toLowerCase();
    return (
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.horario && c.horario.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Importador de Materias */}
      <div className="border border-slate-200/80 rounded-2xl bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-base shrink-0 border border-indigo-100">
              📥
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 tracking-tight">
                Oferta Académica: Carga de Materias
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Publica el catálogo de materias disponibles para que los docentes registren sus prioridades.
              </p>
            </div>
          </div>
          <span className="text-[11px] bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-mono font-medium self-start sm:self-auto border border-slate-200/60">
            Columnas: code, name, cupo, dias, horario, ubicacion
          </span>
        </div>

        <div className="grid md:grid-cols-4 gap-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Semestre destino *
            </label>
            <select
              value={importSemesterId}
              onChange={(e) => onImportSemesterIdChange(e.target.value)}
              className="w-full border border-slate-300/80 rounded-xl px-3 py-2 text-xs bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs cursor-pointer"
            >
              {semesters.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.label} {s.isActive ? "● (Activo)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Archivo Excel / CSV (.xlsx, .xls, .csv)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => onImportFileChange(e.target.files?.[0] || null)}
              className="w-full border border-slate-300/80 rounded-xl px-2.5 py-1.5 text-xs bg-slate-50/50 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer shadow-2xs"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              O pegar enlace (SharePoint / Google Sheets / URL pública)
            </label>
            <input
              placeholder="https://..."
              value={importUrl}
              onChange={(e) => onImportUrlChange(e.target.value)}
              className="w-full border border-slate-300/80 rounded-xl px-3 py-2 text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Para SharePoint usa link con descarga directa o añade <code>?download=1</code>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            onClick={onPreview}
            disabled={importLoading}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition shadow-2xs cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <span>{importLoading ? "⏳" : "🔍"}</span>
            <span>{importLoading ? "Procesando..." : "Previsualizar y Mapear"}</span>
          </button>
          <select
            value={importMode}
            onChange={(e) => onImportModeChange(e.target.value as "replace" | "append")}
            className="border border-slate-300/80 rounded-xl px-3 py-2 text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs cursor-pointer"
          >
            <option value="replace">Reemplazar materias del ciclo (limpiar previas)</option>
            <option value="append">Añadir materias (conservar las existentes)</option>
          </select>
        </div>

        {importMessage && (
          <div
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold ${
              importMessage.type === "ok"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-950"
                : "bg-red-50 border border-red-200 text-red-950"
            }`}
          >
            {importMessage.text}
          </div>
        )}

        {/* Panel de Previsualización y Mapeo */}
        {preview && (
          <div className="border border-indigo-200/80 rounded-2xl p-4 bg-indigo-50/30 space-y-3.5 mt-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                <span>📑</span> Confirmar Mapeo de Columnas ({preview.totalRows} filas detectadas)
              </h3>
              <span className="text-[11px] text-indigo-700 font-medium">
                Verifica la correspondencia de cada campo
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {preview.headers.map((h, idx) => (
                <div key={idx} className="flex flex-col gap-1 border border-slate-200/80 rounded-xl p-2.5 bg-white shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-700 truncate" title={h}>
                    Col {idx + 1}: {h || "(vacía)"}
                  </span>
                  <select
                    value={mapping[String(idx)] || ""}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [String(idx)]: e.target.value }))
                    }
                    className="border border-slate-300/80 rounded-lg px-2 py-1 text-xs bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {FIELD_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto border border-slate-200/80 rounded-xl bg-white shadow-2xs max-h-56">
              <table className="w-full text-xs">
                <thead className="bg-slate-100/80 border-b border-slate-200/80 text-slate-700">
                  <tr>
                    {preview.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-bold uppercase tracking-wider text-[10px]">
                        {h} <span className="text-[10px] text-indigo-600 font-mono block">→ {mapping[String(i)] || "ignorar"}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/60">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-1.5 text-slate-600 border-r border-slate-100 last:border-r-0">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
              <p className="text-[11px] text-slate-500 font-medium">
                Mostrando las primeras 5 de {preview.totalRows} filas detectadas.
              </p>
              <button
                onClick={onImport}
                disabled={importLoading}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <span>{importLoading ? "⏳" : "✓"}</span>
                <span>{importLoading ? "Importando..." : `Confirmar e Importar ${preview.totalRows} materias`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Catálogo de materias en el ciclo */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span>📚</span> Catálogo de Materias del Semestre ({courses.length})
            </h3>
            <input
              type="text"
              placeholder="Buscar materia por clave, nombre o horario..."
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              className="border border-slate-300/80 rounded-xl px-3 py-1.5 text-xs w-full sm:w-72 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition"
            />
          </div>

          <div className="overflow-auto max-h-64 border border-slate-200/80 rounded-2xl bg-white shadow-xs">
            <table className="w-full text-xs">
              <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200/80 text-slate-600 z-10 backdrop-blur-xs">
                <tr>
                  <th className="px-3.5 py-2 text-left font-bold uppercase tracking-wider text-[10px]">Clave</th>
                  <th className="px-3.5 py-2 text-left font-bold uppercase tracking-wider text-[10px]">Materia</th>
                  <th className="px-3.5 py-2 text-center font-bold uppercase tracking-wider text-[10px]">Cupo</th>
                  <th className="px-3.5 py-2 text-left font-bold uppercase tracking-wider text-[10px]">Días</th>
                  <th className="px-3.5 py-2 text-left font-bold uppercase tracking-wider text-[10px]">Horario</th>
                  <th className="px-3.5 py-2 text-left font-bold uppercase tracking-wider text-[10px]">Ubicación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCourses.map((c) => (
                  <tr key={c.id} className="hover:bg-indigo-50/20 transition-colors">
                    <td className="px-3.5 py-2 font-mono font-bold text-indigo-700">{c.code}</td>
                    <td className="px-3.5 py-2 font-semibold text-slate-900">{c.name}</td>
                    <td className="px-3.5 py-2 text-center font-bold text-slate-700">{c.cupo ?? "-"}</td>
                    <td className="px-3.5 py-2 text-slate-600">{c.dias ?? "-"}</td>
                    <td className="px-3.5 py-2 text-slate-600">{c.horario ?? "-"}</td>
                    <td className="px-3.5 py-2 text-slate-500">{c.ubicacion || "Aula s/n"}</td>
                  </tr>
                ))}
                {filteredCourses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      {courses.length === 0
                        ? "Aún no hay materias cargadas en este ciclo."
                        : "No hay materias que coincidan con la búsqueda."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Experiencia Docente e Histórico de 4 Años */}
      <div className="border border-slate-200/80 rounded-2xl bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-base shrink-0 border border-indigo-100">
              🏅
            </div>
            <div>
              <h2 className="font-extrabold text-base text-slate-900 tracking-tight">
                Antecedentes Académicos: Historial de 4 Años & Mérito
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cálculo de periodos impartidos por docente en cada materia (+1 punto por periodo en últimos 4 años, máx. 8 pts).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs cursor-pointer transition-colors flex items-center gap-1.5 active:scale-95">
              <span>{fileUploadLoading ? "⏳" : "⬆️"}</span>
              <span>{fileUploadLoading ? "Subiendo..." : "Subir Archivo Histórico"}</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={onUploadHistoricalFile}
                disabled={fileUploadLoading}
                className="hidden"
              />
            </label>

            <button
              onClick={onToggleFilesDrawer}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300/80 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>📁</span>
              <span>{showFilesDrawer ? "Ocultar Archivos" : `Ver Archivos (${historicalFiles.length})`}</span>
            </button>

            <button
              onClick={onImportHistory}
              disabled={importHistoryLoading}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>{importHistoryLoading ? "⏳" : "↻"}</span>
              <span>{importHistoryLoading ? "Recalculando..." : "Sincronizar desde Histórico"}</span>
            </button>
          </div>
        </div>

        {fileMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
              fileMessage.type === "ok"
                ? "bg-emerald-50 text-emerald-950 border border-emerald-200"
                : "bg-red-50 text-red-950 border border-red-200"
            }`}
          >
            <span>{fileMessage.text}</span>
            <button onClick={onDismissFileMessage} className="text-xs font-bold hover:opacity-75 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Panel de Archivos Históricos */}
        {showFilesDrawer && (
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Archivos en Programación Académica Histórica ({historicalFiles.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Archivos CSV/Excel considerados para el cálculo de mérito docente.
                </p>
              </div>
              <label className="text-xs text-indigo-700 hover:text-indigo-900 font-bold cursor-pointer underline">
                + Subir otro periodo
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={onUploadHistoricalFile}
                  disabled={fileUploadLoading}
                  className="hidden"
                />
              </label>
            </div>

            {historicalFiles.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                No hay archivos en la carpeta de histórico. Sube los archivos de los semestres anteriores.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto">
                {historicalFiles.map((file) => (
                  <div
                    key={file.name}
                    className="bg-white border border-slate-200/80 rounded-xl p-3 flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{file.extension === ".csv" ? "📄" : "📊"}</span>
                        <span className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {file.sizeFormatted} • {new Date(file.updatedAt).toLocaleDateString("es-MX")}
                      </p>
                    </div>

                    <button
                      onClick={() => onDeleteHistoricalFile(file.name)}
                      disabled={fileUploadLoading}
                      title={`Eliminar ${file.name}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tabla de Experiencia por Docente */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Registros de Mérito y Antecedentes</span>
              <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                {teachersExp.length} docentes
              </span>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={expSearch}
                onChange={(e) => setExpSearch(e.target.value)}
                placeholder="Buscar por docente o clave..."
                className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              />
            </div>
          </div>

          <div className="overflow-auto max-h-80 border border-slate-200/80 rounded-2xl bg-white shadow-xs">
            <table className="w-full text-xs">
              <thead className="bg-slate-100/80 border-b border-slate-200/80 text-slate-600 sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">Docente</th>
                  <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">Curso (Clave)</th>
                  <th className="px-4 py-2.5 text-center font-bold uppercase tracking-wider text-[10px]">Periodos Impartidos (4 años)</th>
                  <th className="px-4 py-2.5 text-left font-bold uppercase tracking-wider text-[10px]">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const rows: any[] = [];
                  const query = expSearch.toLowerCase().trim();

                  // Mapear códigos solicitados en el ciclo actual por docente
                  const requestedCodesByTeacher = new Map<number, Set<string>>();
                  if (data?.slots) {
                    for (const s of data.slots) {
                      for (const o of s.options) {
                        if (!requestedCodesByTeacher.has(s.teacher.id)) {
                          requestedCodesByTeacher.set(s.teacher.id, new Set());
                        }
                        requestedCodesByTeacher.get(s.teacher.id)!.add(o.course.code);
                      }
                    }
                  }

                  for (const t of teachersExp) {
                    // Unir todas las materias históricas donde el docente tiene experiencia + las solicitadas en este ciclo
                    const allCodes = new Set<string>();

                    if (t.exps) {
                      for (const exp of t.exps) {
                        if (exp.periods > 0 || (exp.years && exp.years > 0)) {
                          allCodes.add(exp.courseCode);
                        }
                      }
                    }

                    const requested = requestedCodesByTeacher.get(t.id);
                    if (requested) {
                      for (const c of Array.from(requested)) {
                        allCodes.add(c);
                      }
                    }

                    // Filtrado por buscador
                    const matchesTeacher =
                      !query ||
                      t.name.toLowerCase().includes(query) ||
                      (t.employeeId && t.employeeId.toLowerCase().includes(query)) ||
                      t.email.toLowerCase().includes(query);

                    if (allCodes.size === 0) {
                      if (matchesTeacher) {
                        rows.push(
                          <tr key={`${t.id}-global`} className="bg-amber-50/40">
                            <td className="px-4 py-2">
                              <div className="font-bold text-slate-900">{t.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {t.employeeId ? `#${t.employeeId}` : t.email} • Mérito Global
                              </div>
                            </td>
                            <td className="px-4 py-2 text-slate-500 italic">General (sin materias previas registradas)</td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                min={0}
                                max={20}
                                value={expEdit[t.email] ?? String(t.expPeriods ?? t.expYears ?? 0)}
                                onChange={(e) => onExpEditChange(t.email, e.target.value)}
                                className="w-16 border border-slate-300/80 rounded-lg px-2 py-0.5 text-center font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <button
                                onClick={() => onUpdateExp(t.email)}
                                className="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition shadow-2xs cursor-pointer"
                              >
                                Guardar
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    } else {
                      // Ordenar materias alfabéticamente
                      const sortedCodes = Array.from(allCodes).sort();
                      for (const code of sortedCodes) {
                        const matchesCourse = matchesTeacher || code.toLowerCase().includes(query);
                        if (!matchesCourse) continue;

                        const expEntry = t.exps?.find((e) => e.courseCode === code);
                        const periods = expEntry?.periods ?? expEntry?.years ?? 0;
                        const key = `${t.email}_${code}`;
                        const isRequestedThisCycle = requested?.has(code);

                        rows.push(
                          <tr key={`${t.id}-${code}`} className="hover:bg-indigo-50/20 transition-colors">
                            <td className="px-4 py-2">
                              <div className="font-bold text-slate-900">{t.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {t.employeeId ? `#${t.employeeId}` : t.email} • Mérito: {t.expPeriods ?? 0}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                                  {code}
                                </span>
                                {isRequestedThisCycle && (
                                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                                    Solicitada
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input
                                type="number"
                                min={0}
                                max={20}
                                value={expCourseEdit[key] ?? String(periods)}
                                onChange={(e) => onExpCourseEditChange(key, e.target.value)}
                                className="w-16 border border-slate-300/80 rounded-lg px-2 py-0.5 text-center font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <button
                                onClick={() => onUpdateExpCourse(t.email, code)}
                                className="px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition shadow-2xs cursor-pointer"
                              >
                                Guardar
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    }
                  }

                  if (rows.length === 0) {
                    return (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                          {query
                            ? `No se encontraron resultados para "${query}".`
                            : 'No hay registros de experiencia docente cargados. Presiona "Sincronizar desde Histórico".'}
                        </td>
                      </tr>
                    );
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
