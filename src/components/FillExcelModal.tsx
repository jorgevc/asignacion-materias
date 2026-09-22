"use client";

import { useState } from "react";
import type { AnalysisResult, ColumnMapping, HeaderInfo } from "@/lib/excelFiller";

interface FillExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  semesterId: string;
  semesterLabel: string;
  onSuccessMessage?: (msg: string) => void;
}

export default function FillExcelModal({
  isOpen,
  onClose,
  semesterId,
  semesterLabel,
  onSuccessMessage,
}: FillExcelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mapeo editable por el usuario
  const [customMapping, setCustomMapping] = useState<Partial<ColumnMapping>>({});
  const [showMappingSection, setShowMappingSection] = useState(false);
  const [showExtraCoursesList, setShowExtraCoursesList] = useState(false);
  const [showMissingAssignmentsList, setShowMissingAssignmentsList] = useState(true);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError(null);
    setAnalysis(null);
    setCustomMapping({});
    setShowMappingSection(false);

    // Analizar automáticamente al seleccionar archivo
    await runAnalysis(selectedFile, {});
  };

  const runAnalysis = async (targetFile: File, mappingOverride: Partial<ColumnMapping>) => {
    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", targetFile);
      fd.append("semesterId", semesterId);
      fd.append("mode", "preview");
      if (Object.keys(mappingOverride).length > 0) {
        fd.append("mapping", JSON.stringify(mappingOverride));
      }

      const res = await fetch("/api/admin/assignments/fill-excel", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al analizar el archivo Excel.");
      } else {
        const a: AnalysisResult = data.analysis;
        setAnalysis(a);
        setCustomMapping(a.suggestedMapping);
        if (a.isAmbiguous) {
          setShowMappingSection(true);
        }
      }
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyzeWithMapping = async () => {
    if (!file) return;
    await runAnalysis(file, customMapping);
  };

  const handleDownload = async () => {
    if (!file) return;
    setDownloading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("semesterId", semesterId);
      fd.append("mode", "fill");
      if (Object.keys(customMapping).length > 0) {
        fd.append("mapping", JSON.stringify(customMapping));
      }

      const res = await fetch("/api/admin/assignments/fill-excel", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Error al generar el archivo rellenado.");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      let filename = `materias_asignadas_${semesterLabel || semesterId}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (onSuccessMessage) {
        onSuccessMessage(`Archivo "${filename}" descargado exitosamente.`);
      }
      onClose();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setDownloading(false);
    }
  };

  const renderColumnSelector = (
    label: string,
    key: keyof ColumnMapping,
    headers: HeaderInfo[],
    isRequired = false,
    tooltip?: string
  ) => {
    const currentValue = customMapping[key] ?? "";
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-zinc-700 flex items-center justify-between">
          <span>
            {label} {isRequired && <span className="text-red-500">*</span>}
          </span>
          {tooltip && <span className="text-[10px] text-zinc-600 font-normal">{tooltip}</span>}
        </label>
        <select
          value={currentValue}
          onChange={(e) => {
            const val = e.target.value ? Number(e.target.value) : undefined;
            setCustomMapping((prev) => ({ ...prev, [key]: val }));
          }}
          className="border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-zinc-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="">{isRequired ? "-- Seleccionar columna --" : "-- Automático / Nueva --"}</option>
          {headers.map((h) => (
            <option key={h.index} value={h.index}>
              Col {h.index}: {h.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Cabecera */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-2xl shadow-inner">
              📗
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Rellenar Excel con Docentes Asignados</h2>
              <p className="text-xs text-emerald-100">
                Semestre: <b className="text-white">{semesterLabel || semesterId}</b> • Conserva columnas y formatos intactos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
            title="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-6 overflow-y-auto space-y-5 text-zinc-800 flex-1">
          {/* Selector de Archivo */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 block">
              1. Seleccionar o arrastrar archivo Excel de materias (.xlsx o .xls)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex-1 border-2 border-dashed border-zinc-300 hover:border-emerald-500 rounded-xl p-4 bg-zinc-50 hover:bg-emerald-50/40 transition cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center group">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <span className="text-2xl group-hover:scale-110 transition-transform">📂</span>
                <span className="text-xs font-semibold text-zinc-700">
                  {file ? file.name : "Haga clic aquí para seleccionar el archivo Excel"}
                </span>
                <span className="text-[11px] text-zinc-600">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : "Soporta archivos .xlsx y formatos institucionales .xls"}
                </span>
              </label>

              {file && (
                <button
                  type="button"
                  onClick={() => runAnalysis(file, customMapping)}
                  disabled={loading}
                  className="px-3 py-3 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition flex flex-col items-center gap-1 shrink-0"
                  title="Volver a analizar archivo"
                >
                  <span>🔄</span>
                  <span>Reanalizar</span>
                </button>
              )}
            </div>
          </div>

          {/* Mensaje de Error */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2 animate-in fade-in">
              <span className="text-base">⚠️</span>
              <div>
                <b className="font-bold block">Error al procesar:</b>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Spinner de Carga de Análisis */}
          {loading && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-zinc-600">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-medium">Analizando encabezados, materias y asignaciones...</span>
            </div>
          )}

          {/* Resultados del Análisis */}
          {analysis && !loading && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Tarjetas de Estadísticas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                  <div className="text-[11px] font-medium text-zinc-600">Filas en Excel</div>
                  <div className="text-xl font-extrabold text-zinc-900 mt-0.5">{analysis.totalExcelRows}</div>
                  <div className="text-[10px] text-zinc-600">Registros leídos</div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-center">
                  <div className="text-[11px] font-medium text-emerald-800">Con Docente</div>
                  <div className="text-xl font-extrabold text-emerald-700 mt-0.5">{analysis.matchedCount}</div>
                  <div className="text-[10px] text-emerald-800">ID y Profesor listos</div>
                </div>

                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-center">
                  <div className="text-[11px] font-medium text-zinc-600">Vacantes</div>
                  <div className="text-xl font-extrabold text-zinc-700 mt-0.5">{analysis.vacantCount}</div>
                  <div className="text-[10px] text-zinc-600">Quedarán vacías</div>
                </div>

                <div
                  className={`rounded-xl p-3 text-center border ${
                    analysis.missingAssignmentsInExcel.length > 0
                      ? "bg-amber-50 border-amber-300"
                      : "bg-zinc-50 border-zinc-200"
                  }`}
                >
                  <div
                    className={`text-[11px] font-medium ${
                      analysis.missingAssignmentsInExcel.length > 0 ? "text-amber-900 font-bold" : "text-zinc-600"
                    }`}
                  >
                    Nuevas en Amarillo
                  </div>
                  <div
                    className={`text-xl font-extrabold mt-0.5 ${
                      analysis.missingAssignmentsInExcel.length > 0 ? "text-amber-700" : "text-zinc-500"
                    }`}
                  >
                    {analysis.missingAssignmentsInExcel.length}
                  </div>
                  <div className="text-[10px] text-zinc-600">Asignadas no en Excel</div>
                </div>
              </div>

              {/* Alerta Importante 1: Asignaciones en DB no encontradas en el Excel */}
              {analysis.missingAssignmentsInExcel.length > 0 && (
                <div className="p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <div className="text-xs font-bold text-amber-950">
                        {analysis.missingAssignmentsInExcel.length} asignación(es) en base de datos no estaban en el Excel
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMissingAssignmentsList((p) => !p)}
                      className="text-xs text-amber-900 hover:text-amber-950 font-semibold underline cursor-pointer"
                    >
                      {showMissingAssignmentsList ? "Ocultar detalle" : "Ver detalle"}
                    </button>
                  </div>

                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Estas materias y sus profesores asignados se <b>insertarán automáticamente al final</b> de la hoja de cálculo y se
                    resaltarán con <b>fondo amarillo</b> para que puedan ser identificadas y validadas fácilmente.
                  </p>

                  {showMissingAssignmentsList && (
                    <div className="max-h-40 overflow-y-auto border border-amber-200 rounded-lg bg-white/90 p-2 space-y-1.5 text-xs shadow-inner">
                      {analysis.missingAssignmentsInExcel.map((item) => (
                        <div
                          key={item.assignmentId}
                          className="flex items-center justify-between p-1.5 rounded bg-yellow-50 border border-yellow-200 text-zinc-800"
                        >
                          <div>
                            <span className="font-bold text-amber-950">{item.courseCode}</span> • {item.courseName}{" "}
                            {item.horario && <span className="text-zinc-600">({item.horario})</span>}
                          </div>
                          <div className="text-right font-medium text-emerald-900">
                            <span>{item.teacherName}</span>{" "}
                            {item.employeeId && <span className="text-zinc-600 font-mono text-[11px]">[{item.employeeId}]</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Alerta Informativa 2: Materias extras en Excel no registradas en DB */}
              {analysis.extraCoursesInExcel.length > 0 && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">ℹ️</span>
                      <div className="text-xs font-semibold text-blue-950">
                        {analysis.extraCoursesInExcel.length} materia(s) en el archivo Excel no están en la base de datos de este semestre
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowExtraCoursesList((p) => !p)}
                      className="text-xs text-blue-800 hover:text-blue-950 font-semibold underline cursor-pointer"
                    >
                      {showExtraCoursesList ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                  <p className="text-[11px] text-blue-900">
                    Estas filas permanecerán sin cambios en el archivo descargado, con las celdas de profesor e ID vacías.
                  </p>

                  {showExtraCoursesList && (
                    <div className="max-h-32 overflow-y-auto border border-blue-200 rounded-lg bg-white p-2 space-y-1 text-xs">
                      {analysis.extraCoursesInExcel.slice(0, 30).map((c, idx) => (
                        <div key={idx} className="text-zinc-700">
                          <span className="font-semibold text-zinc-900">{c.code}</span> {c.name && `- ${c.name}`}{" "}
                          {c.horario && <span className="text-zinc-600">({c.horario})</span>}
                        </div>
                      ))}
                      {analysis.extraCoursesInExcel.length > 30 && (
                        <div className="text-[11px] text-zinc-600 italic">
                          ... y {analysis.extraCoursesInExcel.length - 30} más.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sección de Mapeo de Columnas (Ambigüedad o Personalización) */}
              <div className="border border-zinc-200 rounded-xl p-3.5 bg-zinc-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                      <span>⚙️</span> Mapeo de Columnas
                      {analysis.isAmbiguous ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          ⚠️ Requiere confirmación
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          ✓ Auto-detectado
                        </span>
                      )}
                    </div>
                    {analysis.ambiguityReason && (
                      <div className="text-[11px] text-amber-800 mt-0.5">{analysis.ambiguityReason}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMappingSection((p) => !p)}
                    className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold cursor-pointer underline"
                  >
                    {showMappingSection ? "Ocultar configuración" : "Modificar columnas"}
                  </button>
                </div>

                {showMappingSection && (
                  <div className="pt-2 border-t border-zinc-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {renderColumnSelector("Columna Código / Clave", "codeCol", analysis.headers, true, "Clave o código")}
                      {renderColumnSelector("Columna Horario", "horarioCol", analysis.headers, false, "Para desempate de secciones")}
                      {renderColumnSelector("Columna Nombre Materia", "nameCol", analysis.headers, false, "Nombre de la materia")}
                      {renderColumnSelector("Columna Días", "diasCol", analysis.headers, false, "Días de la semana")}
                      {renderColumnSelector("Columna ID Docente", "teacherIdCol", analysis.headers, false, "Si no existe, se creará")}
                      {renderColumnSelector("Columna Profesor", "teacherNameCol", analysis.headers, false, "Si no existe, se creará")}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleReanalyzeWithMapping}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                      >
                        Aplicar columnas y recalcular
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div className="px-6 py-4 bg-zinc-100 border-t border-zinc-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-700 transition cursor-pointer"
          >
            Cancelar
          </button>

          {analysis && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || !analysis.suggestedMapping.codeCol}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generando archivo...</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Descargar Excel Rellenado (.xlsx)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
