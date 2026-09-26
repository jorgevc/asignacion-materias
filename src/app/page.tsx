"use client";

import { useEffect, useState } from "react";

type Semester = { id: number; label: string; isActive: boolean; year: number; term: string };
type Course = { id: number; code: string; name: string; cupo: number | null; dias: string | null; horario: string | null; ubicacion: string | null; semesterId: number };

type OptionState = { courseId: string; priority: string; isNone?: boolean };
type SlotsState = {
  1: OptionState[];
  2: OptionState[];
  3: OptionState[];
};

type SubmittedOption = {
  courseId: number;
  course: Course;
  priority: number;
};

type SubmittedSlot = {
  slot_no: number;
  options: SubmittedOption[];
};

const emptyOptions = (): OptionState[] => [
  { courseId: "", priority: "1", isNone: false },
  { courseId: "", priority: "", isNone: false },
  { courseId: "", priority: "", isNone: false },
];

const maskPhone = (ph?: string | null) => {
  if (!ph) return "";
  const cleaned = ph.trim();
  if (cleaned.length <= 4) return "••••";
  const visible = cleaned.slice(-4);
  const masked = "•".repeat(Math.max(cleaned.length - 4, 4));
  return `${masked}${visible}`;
};

export default function Home() {
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [semesterLoading, setSemesterLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);

  // Teacher identification state
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isKnownTeacher, setIsKnownTeacher] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<{ type: "ok" | "error" | "info"; text: string } | null>(null);

  // Submission state
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submittedSlots, setSubmittedSlots] = useState<SubmittedSlot[]>([]);

  // Form input slots
  const [slots, setSlots] = useState<SlotsState>({ 1: emptyOptions(), 2: emptyOptions(), 3: emptyOptions() });
  const [enabledSlot2, setEnabledSlot2] = useState(false);
  const [enabledSlot3, setEnabledSlot3] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 1. Cargar semestre activo por defecto
  useEffect(() => {
    fetch("/api/semesters")
      .then((r) => r.json())
      .then((data: Semester[]) => {
        const active = data.find((s) => s.isActive);
        if (active) {
          setActiveSemester(active);
          fetchCourses(active.id);
        } else {
          setActiveSemester(null);
        }
      })
      .catch((err) => {
        console.error("Error al cargar semestres:", err);
      })
      .finally(() => {
        setSemesterLoading(false);
      });
  }, []);

  const fetchCourses = async (semId: number) => {
    try {
      const res = await fetch(`/api/courses?semesterId=${semId}`);
      const data = await res.json();
      if (Array.isArray(data)) setCourses(data);
    } catch (e) {
      console.error("Error al cargar cursos:", e);
    }
  };

  // 2. Búsqueda y verificación por No. de Trabajador
  const handleLookup = async (inputEmpId?: string) => {
    const rawId = (inputEmpId ?? employeeId).trim();
    if (!rawId) {
      setLookupMessage({ type: "error", text: "Ingresa tu No. de Trabajador para identificarte" });
      return;
    }
    if (!activeSemester) return;

    setLookupLoading(true);
    setLookupMessage(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/petitions?employeeId=${encodeURIComponent(rawId)}&semesterId=${activeSemester.id}`);
      const data = await res.json();

      if (res.ok && data.teacher) {
        setIsKnownTeacher(true);
        setName(data.teacher.name || "");
        setEmail(data.teacher.email || "");
        setPhone(data.teacher.phone || "");

        if (data.isSubmitted && data.slots && data.slots.length > 0) {
          setIsSubmitted(true);
          setSubmittedSlots(data.slots);
          setSubmittedAt(data.submittedAt || null);
          setLookupMessage({
            type: "info",
            text: `Docente: ${data.teacher.name}. Solicitud previamente registrada.`,
          });
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          setIsSubmitted(false);
          setSubmittedSlots([]);
          setSubmittedAt(null);
          setLookupMessage({
            type: "ok",
            text: `Docente verificado: ${data.teacher.name}. Puedes capturar tus solicitudes.`,
          });
        }
      } else {
        setIsKnownTeacher(false);
        setIsSubmitted(false);
        setSubmittedSlots([]);
        setSubmittedAt(null);
        setLookupMessage({
          type: "info",
          text: "No. de Trabajador no encontrado en el catálogo previo. Por favor completa tu Nombre y Correo Institucional.",
        });
      }
    } catch (err) {
      console.error(err);
      setLookupMessage({ type: "error", text: "Error de conexión al consultar el docente" });
    } finally {
      setLookupLoading(false);
    }
  };

  const toggleEmptyOption = (slot: 1 | 2 | 3, index: number, isNone: boolean) => {
    setSlots((prev) => {
      const copy = { ...prev, [slot]: [...prev[slot]] } as SlotsState;
      copy[slot][index] = {
        ...copy[slot][index],
        isNone,
        courseId: isNone ? "" : copy[slot][index].courseId,
        priority: isNone ? "" : copy[slot][index].priority,
      };
      if (isNone && index === 1) {
        copy[slot][2] = {
          ...copy[slot][2],
          isNone: true,
          courseId: "",
          priority: "",
        };
      }
      return copy;
    });
  };

  const updateOption = (slot: 1 | 2 | 3, index: number, field: "courseId" | "priority", value: string) => {
    if (field === "courseId" && value === "__NONE__") {
      toggleEmptyOption(slot, index, true);
      return;
    }
    setSlots((prev) => {
      const copy = { ...prev, [slot]: [...prev[slot]] } as SlotsState;
      const wasNone = copy[slot][index].isNone;
      copy[slot][index] = {
        ...copy[slot][index],
        [field]: value,
        isNone: field === "courseId" && value !== "" ? false : wasNone,
      };
      return copy;
    });
  };

  const validateClient = (): string | null => {
    if (!employeeId.trim()) return "El No. de Trabajador es obligatorio";
    if (!name.trim()) return "El Nombre completo es obligatorio";
    if (!email.trim()) return "El Correo institucional es obligatorio";
    if (!activeSemester) return "No hay un semestre activo para recepción de solicitudes";

    const slotsToCheck: Array<{ slotNo: 1 | 2 | 3; title: string }> = [
      { slotNo: 1, title: "Solicitud 1er Curso" },
    ];
    if (enabledSlot2) slotsToCheck.push({ slotNo: 2, title: "Solicitud 2o Curso" });
    if (enabledSlot3) slotsToCheck.push({ slotNo: 3, title: "Solicitud 3er Curso" });

    for (const { slotNo, title } of slotsToCheck) {
      if (!slots[slotNo][0].courseId || !slots[slotNo][0].priority) {
        return `${title}: La Opción 1 y su prioridad son obligatorias`;
      }
      if (!slots[slotNo][1].isNone && slots[slotNo][1].courseId && !slots[slotNo][1].priority) {
        return `${title}: La Opción 2 requiere seleccionar una prioridad`;
      }
      if (!slots[slotNo][2].isNone && slots[slotNo][2].courseId && !slots[slotNo][2].priority) {
        return `${title}: La Opción 3 requiere seleccionar una prioridad`;
      }

      const validIds = slots[slotNo]
        .filter((o) => !o.isNone && o.courseId && o.courseId !== "__NONE__")
        .map((o) => o.courseId);
      if (new Set(validIds).size !== validIds.length) {
        return `${title}: no puedes seleccionar el mismo curso más de una vez dentro de la misma solicitud`;
      }
    }
    return null;
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const err = validateClient();
    if (err) {
      setMessage({ type: "error", text: err });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    if (!activeSemester) return;

    setLoading(true);
    setMessage(null);

    const payloadSlots = [];
    payloadSlots.push({
      slot_no: 1,
      options: slots[1]
        .filter((o) => !o.isNone && o.courseId && o.courseId !== "__NONE__")
        .map((o) => ({ courseId: Number(o.courseId), priority: Number(o.priority) })),
    });
    if (enabledSlot2) {
      payloadSlots.push({
        slot_no: 2,
        options: slots[2]
          .filter((o) => !o.isNone && o.courseId && o.courseId !== "__NONE__")
          .map((o) => ({ courseId: Number(o.courseId), priority: Number(o.priority) })),
      });
    }
    if (enabledSlot3) {
      payloadSlots.push({
        slot_no: 3,
        options: slots[3]
          .filter((o) => !o.isNone && o.courseId && o.courseId !== "__NONE__")
          .map((o) => ({ courseId: Number(o.courseId), priority: Number(o.priority) })),
      });
    }

    try {
      const res = await fetch("/api/petitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employeeId.trim(),
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          semesterId: activeSemester.id,
          slots: payloadSlots,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Si el error es 409 (ya enviadas), consultar sus peticiones existentes y pasar directamente a la vista de recibo
        if (res.status === 409) {
          const fetchRes = await fetch(
            `/api/petitions?employeeId=${encodeURIComponent(employeeId.trim())}&semesterId=${activeSemester.id}`
          );
          const fetchData = await fetchRes.json();
          if (fetchData.isSubmitted && fetchData.slots && fetchData.slots.length > 0) {
            setIsSubmitted(true);
            setSubmittedSlots(fetchData.slots);
            setSubmittedAt(fetchData.submittedAt || new Date().toISOString());
            setMessage({
              type: "ok",
              text: "Tus solicitudes ya se encuentran registradas en el sistema.",
            });
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
        }
        setMessage({ type: "error", text: data.error || "Error al enviar la solicitud" });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Envío exitoso: activar modo solicitud guardada y hacer scroll automático al inicio
        setIsSubmitted(true);
        setSubmittedSlots(data.slots || []);
        setSubmittedAt(data.submittedAt || new Date().toISOString());
        setMessage({
          type: "ok",
          text: "¡Solicitud registrada con éxito!",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error de conexión al enviar las peticiones" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetConsultation = () => {
    setEmployeeId("");
    setName("");
    setEmail("");
    setPhone("");
    setIsKnownTeacher(false);
    setIsSubmitted(false);
    setSubmittedSlots([]);
    setSubmittedAt(null);
    setLookupMessage(null);
    setMessage(null);
    setSlots({ 1: emptyOptions(), 2: emptyOptions(), 3: emptyOptions() });
    setEnabledSlot2(false);
    setEnabledSlot3(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderSlotCapture = (slotNo: 1 | 2 | 3, enabled: boolean, setEnabled?: (v: boolean) => void) => {
    const isRequired = slotNo === 1;
    const isActive = isRequired || enabled;
    let title = "";
    if (slotNo === 1) {
      title = "Solicitud 1er Curso (Elige 3 opciones con sus prioridades. Se te asignará sólo uno de ellos)";
    } else if (slotNo === 2) {
      title = "Solicitud 2o Curso (Elige 3 opciones con sus prioridades. Una vez asignado el 1er Curso para todos los profesores, se atenderá esta solicitud con los cursos disponibles. En caso de disponibilidad se asignará sólo un curso de estas 3 opciones)";
    } else {
      title = "Solicitud 3er Curso (Elige 3 opciones con sus prioridades. Una vez asignado el 1er y 2o Curso para todos los profesores, se atenderá esta solicitud con los cursos disponibles. En caso de disponibilidad se asignará sólo un curso de estas 3 opciones)";
    }

    return (
      <div
        className={`rounded-xl p-5 transition-all shadow-sm ${
          isActive
            ? "border-2 border-indigo-500 bg-white shadow-md ring-1 ring-indigo-500/20"
            : "border-2 border-zinc-300 bg-zinc-50/80"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-start gap-2.5">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-zinc-300 text-zinc-800"
              }`}
            >
              {slotNo}
            </span>
            <h3 className="font-bold text-sm sm:text-base leading-snug text-zinc-900">
              {title}
            </h3>
          </div>
          {!isRequired && setEnabled && (
            <label
              className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 text-sm font-bold cursor-pointer select-none transition-all shrink-0 shadow-xs ${
                enabled
                  ? "bg-indigo-600 border-indigo-700 text-white ring-2 ring-indigo-400/40"
                  : "bg-white border-zinc-500 text-zinc-900 hover:bg-zinc-100 hover:border-zinc-700"
              }`}
            >
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
              />
              <span className="text-sm font-bold">
                {enabled ? `✓ ${slotNo === 2 ? "2o Curso" : "3er Curso"} Habilitado` : `Habilitar ${slotNo === 2 ? "2o Curso" : "3er Curso"}`}
              </span>
            </label>
          )}
        </div>

        <div className={`grid gap-3 transition-opacity ${!isActive ? "opacity-40 pointer-events-none" : ""}`}>
          {[0, 1, 2].map((idx) => {
            const isOptionEmpty = Boolean(slots[slotNo][idx].isNone);
            const isPrevEmpty = idx === 2 && Boolean(slots[slotNo][1].isNone);

            return (
              <div
                key={idx}
                className={`border rounded-lg p-3 transition-all ${
                  isOptionEmpty
                    ? "bg-amber-50/40 border-amber-300"
                    : isActive
                    ? "bg-white border-zinc-200 shadow-2xs"
                    : "bg-zinc-100/70 border-zinc-200 text-zinc-400"
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-3 items-end">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`block text-xs font-semibold ${isActive ? "text-zinc-700" : "text-zinc-400"}`}>
                        Curso Opción {idx + 1} {idx === 0 ? "*" : ""}
                      </label>

                      {idx > 0 && isActive && (
                        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            disabled={!isActive || isPrevEmpty}
                            checked={isOptionEmpty}
                            onChange={(e) => toggleEmptyOption(slotNo, idx as 1 | 2, e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-amber-600 accent-amber-600 cursor-pointer"
                          />
                          <span className={isOptionEmpty ? "font-bold text-amber-900" : "text-zinc-600"}>
                            No tengo otra opción
                          </span>
                        </label>
                      )}
                    </div>

                    <select
                      disabled={!isActive || isOptionEmpty}
                      value={isOptionEmpty ? "__NONE__" : slots[slotNo][idx].courseId}
                      onChange={(e) => updateOption(slotNo, idx, "courseId", e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isOptionEmpty
                          ? "bg-amber-100/50 border-amber-300 text-amber-900 font-semibold cursor-not-allowed"
                          : isActive
                          ? "bg-white border-zinc-300 text-zinc-900 font-normal hover:border-zinc-400"
                          : "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed"
                      }`}
                    >
                      {isOptionEmpty ? (
                        <option value="__NONE__">-- Sin otra opción (Opción vacía) --</option>
                      ) : (
                        <>
                          <option value="">-- Selecciona un curso --</option>
                          {idx > 0 && <option value="__NONE__">-- No tengo otra opción (dejar vacía) --</option>}
                          {courses.map((c) => (
                            <option key={c.id} value={String(c.id)}>
                              {c.code} - {c.name} | Cupo: {c.cupo ?? "-"} | {c.dias ?? "-"} {c.horario ?? ""} | {c.ubicacion ?? "-"}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isActive && !isOptionEmpty ? "text-zinc-700" : "text-zinc-400"}`}>
                      Prioridad {idx === 0 ? "*" : ""}
                    </label>
                    <select
                      disabled={!isActive || isOptionEmpty}
                      value={isOptionEmpty ? "" : slots[slotNo][idx].priority}
                      onChange={(e) => updateOption(slotNo, idx, "priority", e.target.value)}
                      className={`w-full border rounded-lg px-3 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isOptionEmpty
                          ? "bg-amber-100/50 border-amber-300 text-amber-700 cursor-not-allowed"
                          : isActive
                          ? "bg-white border-zinc-300 text-zinc-900 hover:border-zinc-400"
                          : "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed"
                      }`}
                    >
                      {isOptionEmpty ? (
                        <option value="">N/A</option>
                      ) : (
                        <>
                          <option value="">-- Prioridad --</option>
                          <option value="1">1 - Alta (P1)</option>
                          <option value="2">2 - Media (P2)</option>
                          <option value="3">3 - Baja (P3)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {isOptionEmpty && (
                  <div className="mt-2.5 p-2.5 rounded-lg bg-amber-100/80 border border-amber-300 text-xs text-amber-950 flex items-start gap-2">
                    <span className="text-base shrink-0 leading-none">⚠️</span>
                    <p className="leading-snug">
                      <strong>Aviso importante:</strong> Al marcar esta opción eres consciente de que si no se te asignan los cursos de tus otras opciones, <strong>no se te asignará ningún curso</strong> en esta solicitud.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className={`text-xs mt-2 ${isActive ? "text-zinc-500" : "text-zinc-400"}`}>
          💡 Puedes repetir prioridades dentro de la misma solicitud, para indicar igualdad de preferencias. También se permite repetir cursos en diferentes solicitudes (las rondas se atienden independientemente).
        </p>
      </div>
    );
  };

  const getPriorityBadge = (p: number) => {
    switch (p) {
      case 1:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">P1 - Alta</span>;
      case 2:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">P2 - Media</span>;
      case 3:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800">P3 - Baja</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800">P{p}</span>;
    }
  };

  const numCoursesRequested = enabledSlot3 ? 3 : enabledSlot2 ? 2 : 1;

  const countValidOptions = (opts: OptionState[]) =>
    opts.filter((o) => !o.isNone && o.courseId && o.courseId !== "__NONE__").length;

  const totalValidOptions =
    countValidOptions(slots[1]) +
    (enabledSlot2 ? countValidOptions(slots[2]) : 0) +
    (enabledSlot3 ? countValidOptions(slots[3]) : 0);

  const hasAnyEmptyOption =
    slots[1].slice(1).some((o) => o.isNone) ||
    (enabledSlot2 && slots[2].slice(1).some((o) => o.isNone)) ||
    (enabledSlot3 && slots[3].slice(1).some((o) => o.isNone));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      {/* Header Institucional */}
      <header className="border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">
            Sistema de Asignación Docente
          </h1>
          <p className="text-sm text-zinc-600 mt-0.5">
            Recepción de solicitudes de cursos y carga académica
          </p>
        </div>

        {/* Indicador Fijo del Semestre Activo */}
        <div className="flex items-center gap-3">
          {semesterLoading ? (
            <div className="animate-pulse h-10 w-44 bg-zinc-200 rounded-lg"></div>
          ) : activeSemester ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2 flex items-center gap-2.5 text-emerald-900">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
              <div>
                <p className="text-xs text-emerald-700 font-medium leading-none">Semestre Activo</p>
                <p className="text-sm font-bold leading-tight">{activeSemester.label}</p>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2 text-red-800 text-xs font-medium">
              ⚠️ Convocatoria cerrada (Sin semestre activo)
            </div>
          )}
        </div>
      </header>

      {/* Alerta si no hay semestre activo */}
      {!semesterLoading && !activeSemester && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">Periodo de asignación inactivo</p>
          <p>Actualmente no hay ningún ciclo escolar abierto para la recepción de solicitudes. Por favor comunícate con la administración académica para conocer las fechas de apertura.</p>
        </div>
      )}

      {/* Mensajes globales de feedback */}
      {message && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium ${
            message.type === "ok"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* CONDICIONAL PRINCIPAL:
          SI isSubmitted === true -> VISTA EXCLUSIVA DE RECIBO / COMPROBANTE OFICIAL
          SI isSubmitted === false -> FORMULARIO DE IDENTIFICACIÓN Y CAPTURA */}
      {isSubmitted ? (
        /* ========================================================================= */
        /* VISTA DE RECIBO / COMPROBANTE OFICIAL DE SOLICITUD DE CURSOS               */
        /* ========================================================================= */
        <section className="bg-white border-2 border-emerald-500 rounded-2xl p-6 sm:p-8 shadow-lg space-y-6">
          {/* Encabezado del Recibo */}
          <div className="border-b pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-black shrink-0">
                ✓
              </div>
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 mb-1">
                  SOLICITUD REGISTRADA
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900">
                  Solicitud de Cursos
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Ciclo escolar {activeSemester?.label}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right w-full sm:w-auto">
              <p className="text-2xs uppercase tracking-wider text-zinc-400 font-semibold">Fecha y hora de registro</p>
              <p className="text-xs text-zinc-600 font-medium mt-0.5">
                {submittedAt ? new Date(submittedAt).toLocaleString("es-MX") : new Date().toLocaleString("es-MX")}
              </p>
            </div>
          </div>

          {/* Ficha Técnica del Docente */}
          <div className="bg-zinc-50/80 border rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-wide">No. de Trabajador (ID)</p>
              <p className="text-sm font-bold text-zinc-900 font-mono mt-0.5">{employeeId}</p>
            </div>
            <div>
              <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-wide">Profesor(a)</p>
              <p className="text-sm font-bold text-zinc-900 mt-0.5">{name}</p>
            </div>
            <div>
              <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-wide">Correo Institucional</p>
              <p className="text-sm font-semibold text-zinc-900 truncate mt-0.5">{email}</p>
            </div>
            <div>
              <p className="text-2xs font-semibold text-zinc-500 uppercase tracking-wide">Celular Registrado</p>
              <p className="text-sm font-semibold text-zinc-900 font-mono mt-0.5">{maskPhone(phone) || "No registrado"}</p>
            </div>
          </div>

          {/* Desglose de Cursos Solicitados */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-900">
                Cursos y Opciones Registradas ({submittedSlots.length} {submittedSlots.length === 1 ? "Curso Solicitado" : "Cursos Solicitados"})
              </h3>
              <span className="text-xs text-zinc-500 font-medium">
                1 materia asignable por curso solicitado
              </span>
            </div>

            <div className="grid gap-4">
              {submittedSlots.map((s) => (
                <div key={s.slot_no} className="border rounded-xl p-4 bg-white shadow-2xs">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                    <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center">
                      {s.slot_no}
                    </span>
                    <h4 className="font-bold text-sm text-zinc-900">
                      {s.slot_no === 1 ? "Solicitud 1er Curso" : s.slot_no === 2 ? "Solicitud 2o Curso" : "Solicitud 3er Curso"}
                    </h4>
                    <span className="ml-auto text-xs text-zinc-500">
                      {s.options.length} {s.options.length === 1 ? "opción postulada" : "opciones postuladas"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[0, 1, 2].map((optIdx) => {
                      const opt = s.options[optIdx];
                      if (opt) {
                        return (
                          <div key={optIdx} className="bg-zinc-50/70 border border-zinc-200 rounded-lg p-3 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-xs font-mono font-bold text-zinc-800 bg-white border px-1.5 py-0.5 rounded">
                                  {opt.course?.code || "MAT"}
                                </span>
                                {getPriorityBadge(opt.priority)}
                              </div>
                              <p className="text-sm font-semibold text-zinc-900 leading-snug">
                                {opt.course?.name}
                              </p>
                            </div>
                            <div className="text-xs text-zinc-500 mt-2.5 pt-2 border-t flex flex-wrap gap-x-2 gap-y-1">
                              <span>🕒 {opt.course?.horario || "Sin horario"}</span>
                              <span>📅 {opt.course?.dias || "Sin días"}</span>
                              <span>📍 {opt.course?.ubicacion || "Aula -"}</span>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div
                            key={optIdx}
                            className="bg-zinc-50 border border-dashed border-zinc-300 rounded-lg p-3 flex flex-col justify-center items-center text-center text-zinc-500 min-h-[90px]"
                          >
                            <span className="text-xs font-semibold text-zinc-400 mb-0.5">Opción {optIdx + 1}</span>
                            <p className="text-xs text-zinc-500 font-medium italic">Sin otra opción registrada (Vacío)</p>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>


          {/* Pie de comprobante con botón discreto */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t">
            <p className="text-xs text-zinc-400">
              Solicitud guardada en el sistema.
            </p>
            <button
              type="button"
              onClick={handleResetConsultation}
              className="text-xs text-zinc-500 hover:text-zinc-800 hover:underline px-2 py-1 transition-colors"
            >
              Consultar otro docente
            </button>
          </div>
        </section>
      ) : (
        /* ========================================================================= */
        /* VISTA DE FORMULARIO DE CAPTURA Y IDENTIFICACIÓN                           */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Tarjeta de Identificación */}
          <section className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <span>👤</span> Identificación del Docente
              </h2>
              {employeeId && (
                <button
                  type="button"
                  onClick={handleResetConsultation}
                  className="text-xs text-zinc-500 hover:text-zinc-800 underline"
                >
                  Limpiar campos
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  No. de Trabajador (ID) *
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleLookup();
                      }
                    }}
                    onBlur={() => {
                      if (employeeId.trim() && !name) handleLookup();
                    }}
                    placeholder="Ej. 100345678"
                    className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm font-semibold tracking-wide uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    disabled={lookupLoading || !employeeId.trim()}
                    onClick={() => handleLookup()}
                    className="px-3 py-2 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 disabled:opacity-50 shrink-0"
                  >
                    {lookupLoading ? "..." : "Buscar"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del profesor"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Correo Institucional *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="profesor@correo.buap.mx"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Teléfono Celular <span className="font-normal text-zinc-500">(Opcional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. 81 1234 5678"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {lookupMessage && (
              <div
                className={`px-3.5 py-2 rounded-lg text-xs font-medium ${
                  lookupMessage.type === "ok"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : lookupMessage.type === "error"
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-blue-50 text-blue-800 border border-blue-200"
                }`}
              >
                {lookupMessage.text}
              </div>
            )}
          </section>

          {/* Formulario de selección de cursos */}
          <form onSubmit={handlePreSubmit} className="space-y-6">
            {renderSlotCapture(1, true)}
            {renderSlotCapture(2, enabledSlot2, setEnabledSlot2)}
            {renderSlotCapture(3, enabledSlot3, setEnabledSlot3)}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="text-xs text-zinc-600">
                Total de cursos solicitados: <strong className="text-zinc-900 font-bold">{numCoursesRequested} {numCoursesRequested === 1 ? "Curso" : "Cursos"}</strong> ({totalValidOptions} {totalValidOptions === 1 ? "opción registrada" : "opciones registradas en total"}).
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setSlots({ 1: emptyOptions(), 2: emptyOptions(), 3: emptyOptions() });
                    setEnabledSlot2(false);
                    setEnabledSlot3(false);
                  }}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-lg border bg-white hover:bg-zinc-50 text-sm font-medium text-zinc-700"
                >
                  Limpiar campos
                </button>

                <button
                  type="submit"
                  disabled={loading || !activeSemester || !employeeId.trim()}
                  className="flex-1 sm:flex-initial px-7 py-2.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-sm font-bold shadow-sm disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar solicitudes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Confirmación Definitiva */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl font-bold mx-auto">
              ⚠️
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-zinc-900">
                ¿Confirmas el envío definitivo?
              </h3>
              <p className="text-xs text-zinc-600 mt-2">
                Estás a punto de enviar tus solicitudes para el ciclo escolar <strong>{activeSemester?.label}</strong>.
              </p>
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 text-left space-y-2">
                <p className="font-semibold">Ten en cuenta:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>No podrás modificar ni editar tus opciones una vez enviadas.</li>
                  <li>
                    Se registrará solicitud de {numCoursesRequested} {numCoursesRequested === 1 ? "Curso" : "Cursos"} ({totalValidOptions} {totalValidOptions === 1 ? "opción" : "opciones"} en total) para {name} ({employeeId}).
                  </li>
                </ul>

                {hasAnyEmptyOption && (
                  <div className="p-2 rounded bg-amber-100/90 border border-amber-300 font-semibold text-amber-950 mt-1">
                    ⚠️ Has marcado opciones como &quot;Sin otra opción&quot;. Si los cursos elegidos no están disponibles para ti, no recibirás carga para esa solicitud.
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Volver a revisar
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm"
              >
                Sí, confirmar y enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
