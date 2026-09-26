"use client";

import { useEffect, useState } from "react";
import { escapeCsvCell } from "@/lib/csv";
import type { RescueAnalysisResult } from "@/lib/asignador";
import FillExcelModal from "@/components/FillExcelModal";
import NewSemesterModal, { SemesterData } from "@/components/NewSemesterModal";
import AdminHeader, { AdminTab } from "@/components/admin/AdminHeader";
import AdminSetupTab from "@/components/admin/AdminSetupTab";
import AdminPetitionsTab from "@/components/admin/AdminPetitionsTab";
import AdminAssignmentTab from "@/components/admin/AdminAssignmentTab";
import AdminResultsTab from "@/components/admin/AdminResultsTab";
import {
  AdminData,
  Course,
  HistoricalFile,
  LastRecalculatedEvent,
  RecalculatedTeacherDetail,
  ResolvedRescueRecord,
  Semester,
  Teacher,
  TeacherWithExps,
  TieGroup,
} from "@/components/admin/types";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("assignment");
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
  const [assignments, setAssignments] = useState<{ total: number; assignments: Array<{ id: number; teacherId: number; courseId: number; slotNo: number; priority: number; puntaje: number; detalle: any; teacher: Teacher & { expPeriods?: number; expYears?: number }; course: Course }> } | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState<number | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [assignmentSort, setAssignmentSort] = useState<"default" | "curso">("default");
  const [assignmentSlotFilter, setAssignmentSlotFilter] = useState<"all" | 1 | 2 | 3>("all");
  const [lastRecalculatedEvent, setLastRecalculatedEvent] = useState<LastRecalculatedEvent | null>(null);

  const [teachersExp, setTeachersExp] = useState<Array<Teacher & { expPeriods?: number; expYears?: number; exps?: Array<{ courseCode: string; periods: number; years?: number }> }>>([]);
  const [importHistoryLoading, setImportHistoryLoading] = useState(false);
  const [historicalFiles, setHistoricalFiles] = useState<Array<{ name: string; sizeFormatted: string; updatedAt: string; extension: string }>>([]);
  const [showFilesDrawer, setShowFilesDrawer] = useState(false);
  const [fileUploadLoading, setFileUploadLoading] = useState(false);
  const [fileMessage, setFileMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [expEdit, setExpEdit] = useState<Record<string, string>>({});
  const [expCourseEdit, setExpCourseEdit] = useState<Record<string, string>>({});
  const [empates, setEmpates] = useState<Array<{ courseId: number; courseCode: string; courseName: string; priority: number; puntaje: number; tied: Array<{ teacherId: number; teacherName: string; puntaje: number; petitionId: number }> }>>([]);
  const [reassignPick, setReassignPick] = useState<Record<number, number>>({});
  const [lastSlot, setLastSlot] = useState<number | null>(null);
  const [activeRescueSlot, setActiveRescueSlot] = useState<number>(1);
  const [simulateResult, setSimulateResult] = useState<any>(null);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [rescueAnalysis, setRescueAnalysis] = useState<RescueAnalysisResult | null>(null);
  const [rescueLoading, setRescueLoading] = useState(false);
  const [rescueTab, setRescueTab] = useState<Record<number, "opcion1" | "opcion2" | "opcion3" | "opcion4">>({});
  const [vistoBuenoConfirm, setVistoBuenoConfirm] = useState<Record<string, boolean>>({});
  const [vacantSearch, setVacantSearch] = useState<string>("");
  const [resolvedRescueCases, setResolvedRescueCases] = useState<ResolvedRescueRecord[]>([]);
  const [showFillExcelModal, setShowFillExcelModal] = useState(false);
  const [showNewSemesterModal, setShowNewSemesterModal] = useState(false);
  const [activatingSemester, setActivatingSemester] = useState(false);
  const [activeSelectId, setActiveSelectId] = useState<string>("");

  const fetchSemesters = async (preserveSelection = false) => {
    try {
      const res = await fetch("/api/admin/semesters");
      const s = await res.json();
      if (Array.isArray(s)) {
        setSemesters(s);
        const active = s.find((x: Semester) => x.isActive);
        if (active) {
          setActiveSelectId(String(active.id));
        } else if (s.length > 0) {
          setActiveSelectId(String(s[0].id));
        }

        if (!preserveSelection) {
          if (active) {
            setSemesterId(String(active.id));
            setImportSemesterId(String(active.id));
          } else if (s.length > 0) {
            setSemesterId(String(s[0].id));
            setImportSemesterId(String(s[0].id));
          }
        }
      }
    } catch (err) {
      console.error("Error al cargar semestres:", err);
    }
  };

  const handleActivateSemester = async (idToActivate: number) => {
    if (!idToActivate) return;
    setActivatingSemester(true);
    try {
      const res = await fetch("/api/admin/semesters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idToActivate }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "No se pudo activar el semestre");
      } else {
        await fetchSemesters(true);
        // Sincronizar la vista al semestre recién activado
        setSemesterId(String(idToActivate));
        setImportSemesterId(String(idToActivate));
      }
    } catch (err: any) {
      alert("Error al activar semestre: " + err.message);
    } finally {
      setActivatingSemester(false);
    }
  };

  const handleSemesterCreated = async (newSem: SemesterData) => {
    await fetchSemesters(true);
    if (newSem.isActive) {
      setSemesterId(String(newSem.id));
      setImportSemesterId(String(newSem.id));
      setActiveSelectId(String(newSem.id));
    }
  };

  useEffect(() => {
    fetchSemesters();
    fetchHistoricalFiles();
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
    if (semesterId) {
      fetchAssignments();
      fetchRescueAnalysis(semesterId, 1);
      loadResolvedRescueCases(semesterId, 1);
    }
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
        setActiveRescueSlot(slotNo);
        setAssignmentSlotFilter(slotNo as 1 | 2 | 3);
        setSimulateResult(null);
      } else {
        setAssignmentMessage({ type: "ok", text: `Slot ${slotNo}: asignados ${j.asignados?.length ?? 0}, restantes ${j.cursosRestantes}${j.empates?.length ? `, empates ${j.empates.length}` : ""}` });
        setEmpates(j.empates || []);
        setLastSlot(slotNo);
        setActiveRescueSlot(slotNo);
        setAssignmentSlotFilter(slotNo as 1 | 2 | 3);
        setSimulateResult(null);
        fetchAssignments();
        fetchRescueAnalysis(semesterId, slotNo);
        loadResolvedRescueCases(semesterId, slotNo);
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setAssignmentLoading(null);
    }
  };

  const getRescueStorageKey = (sid: string | number, slot: number) => `rescue_resolved_${sid}_${slot}`;

  const loadResolvedRescueCases = (sid = semesterId, slot = activeRescueSlot || lastSlot || 1) => {
    if (!sid) return;
    try {
      const stored = localStorage.getItem(getRescueStorageKey(sid, slot));
      if (stored) {
        setResolvedRescueCases(JSON.parse(stored));
      } else {
        setResolvedRescueCases([]);
      }
    } catch {
      setResolvedRescueCases([]);
    }
  };

  const fetchRescueAnalysis = async (sid = semesterId, slot = activeRescueSlot || lastSlot || 1) => {
    if (!sid) return;
    try {
      const res = await fetch(`/api/admin/assignments/rescue-analysis?semesterId=${sid}&slotNo=${slot}`);
      const j = await res.json();
      if (res.ok && j.ok) {
        setRescueAnalysis(j.data);
      } else {
        setRescueAnalysis(null);
      }
    } catch (e) {
      console.error(e);
      setRescueAnalysis(null);
    }
  };

  const switchRescueSlot = (slot: number) => {
    setActiveRescueSlot(slot);
    setAssignmentSlotFilter(slot as 1 | 2 | 3);
    fetchRescueAnalysis(semesterId, slot);
    loadResolvedRescueCases(semesterId, slot);
  };

  const handleExecuteRescue = async (
    slotNo: number,
    teacherId: number,
    teacherName: string,
    optionLabel: string,
    newLocked: Array<{ courseId: number; teacherId: number }>,
    description: string
  ) => {
    if (!semesterId) return;
    setRescueLoading(true);
    try {
      const previousLocks = resolvedRescueCases
        .filter((r) => r.teacherId !== teacherId)
        .flatMap((r) => r.locked);
      const combinedLocked = [...previousLocks, ...newLocked];

      const res = await fetch(`/api/admin/assignments/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId: Number(semesterId),
          slotNo,
          locked: combinedLocked,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAssignmentMessage({ type: "error", text: `❌ No se pudo aplicar: ${j.error || "Restricción de cupo o colisión detectada"}` });
      } else {
        const assigned = (j.asignados || []).find((a: any) => a.teacherId === teacherId);
        const assignedSummary = assigned
          ? `${assigned.courseCode} - ${assigned.courseName}`
          : "Asignado";

        const newRecord: ResolvedRescueRecord = {
          teacherId,
          teacherName,
          optionLabel,
          description,
          assignedCourseSummary: assignedSummary,
          locked: newLocked,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        const updated = [...resolvedRescueCases.filter((r) => r.teacherId !== teacherId), newRecord];
        setResolvedRescueCases(updated);
        try {
          localStorage.setItem(getRescueStorageKey(semesterId, slotNo), JSON.stringify(updated));
        } catch {}

        const lockedTeacherIds = new Set(newLocked.map((l) => l.teacherId));
        const affected: RecalculatedTeacherDetail[] = (j.asignados || [])
          .filter((a: any) => lockedTeacherIds.has(a.teacherId))
          .map((a: any) => ({
            teacherId: a.teacherId,
            teacherName: a.teacherName,
            courseCode: a.courseCode,
            courseName: a.courseName,
            priority: a.priority,
            puntaje: a.puntaje,
            detalle: a.detalle,
          }));

        setLastRecalculatedEvent({
          slotNo,
          actionTitle: `${optionLabel}: ${teacherName}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          affectedTeachers: affected,
          stats: j.stats,
        });

        setActiveRescueSlot(slotNo);
        setAssignmentSlotFilter(slotNo as 1 | 2 | 3);

        setAssignmentMessage({
          type: "ok",
          text: `✅ ${teacherName} resuelto con éxito (${optionLabel}). Slot ${slotNo} recalculado exitosamente.`,
        });

        await fetchAssignments();
        await fetchRescueAnalysis(semesterId, slotNo);
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setRescueLoading(false);
    }
  };

  const handleUndoRescue = async (slotNo: number, teacherId: number) => {
    if (!semesterId) return;
    setRescueLoading(true);
    try {
      const remaining = resolvedRescueCases.filter((r) => r.teacherId !== teacherId);
      const remainingLocked = remaining.flatMap((r) => r.locked);

      const res = await fetch(`/api/admin/assignments/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId: Number(semesterId),
          slotNo,
          locked: remainingLocked,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAssignmentMessage({ type: "error", text: `❌ Error al revertir: ${j.error || "Fallo en la reversión"}` });
      } else {
        setResolvedRescueCases(remaining);
        try {
          localStorage.setItem(getRescueStorageKey(semesterId, slotNo), JSON.stringify(remaining));
        } catch {}

        setLastRecalculatedEvent({
          slotNo,
          actionTitle: `Deshacer Resolución`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          affectedTeachers: [],
          stats: j.stats,
        });

        setActiveRescueSlot(slotNo);
        setAssignmentSlotFilter(slotNo as 1 | 2 | 3);

        setAssignmentMessage({
          type: "ok",
          text: `↩️ Resolución revertida. El docente ha vuelto a la lista de casos pendientes.`,
        });

        await fetchAssignments();
        await fetchRescueAnalysis(semesterId, slotNo);
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setRescueLoading(false);
    }
  };

  const handleResetAllRescues = async (slotNo: number) => {
    if (!semesterId) return;
    if (!window.confirm(`¿Está seguro de revertir todas las resoluciones aplicadas en el Slot ${slotNo}? El slot volverá a su asignación inicial.`)) return;
    setRescueLoading(true);
    try {
      const res = await fetch(`/api/admin/assignments/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId: Number(semesterId),
          slotNo,
          locked: [],
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAssignmentMessage({ type: "error", text: `❌ Error al reiniciar: ${j.error || "Fallo al reiniciar"}` });
      } else {
        setResolvedRescueCases([]);
        try {
          localStorage.removeItem(getRescueStorageKey(semesterId, slotNo));
        } catch {}

        setLastRecalculatedEvent({
          slotNo,
          actionTitle: `Reinicio de Resoluciones (Slot ${slotNo})`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          affectedTeachers: [],
          stats: j.stats,
        });

        setActiveRescueSlot(slotNo);
        setAssignmentSlotFilter(slotNo as 1 | 2 | 3);

        setAssignmentMessage({
          type: "ok",
          text: `↺ Se han revertido todas las resoluciones del Slot ${slotNo}. Tablero reiniciado.`,
        });
        await fetchAssignments();
        await fetchRescueAnalysis(semesterId, slotNo);
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setRescueLoading(false);
    }
  };

  const handleBorrarSlot = async (slotNo?: number) => {
    if (!semesterId) return;
    const url = slotNo ? `/api/admin/assignments?semesterId=${semesterId}&slotNo=${slotNo}` : `/api/admin/assignments?semesterId=${semesterId}`;
    const res = await fetch(url, { method: "DELETE" });
    const j = await res.json();
    if (res.ok) {
      setAssignmentMessage({ type: "ok", text: `Borradas ${j.deleted} asignaciones ${slotNo ? `slot ${slotNo}` : "todas"}` });
      setRescueAnalysis(null);
      setResolvedRescueCases([]);
      if (slotNo) {
        localStorage.removeItem(getRescueStorageKey(semesterId, slotNo));
      } else {
        [1, 2, 3].forEach((s) => localStorage.removeItem(getRescueStorageKey(semesterId, s)));
      }
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
        fetchRescueAnalysis(semesterId, slotNo);
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
        fetchRescueAnalysis(semesterId, lastSlot);
      }
    } catch (e) {
      setAssignmentMessage({ type: "error", text: String(e) });
    } finally {
      setAssignmentLoading(null);
    }
  };

  const fetchTeachersExp = async () => {
    try {
      const url = semesterId
        ? `/api/admin/teachers/exp?semesterId=${semesterId}`
        : `/api/admin/teachers/exp`;
      const res = await fetch(url);
      const j = await res.json();
      if (Array.isArray(j)) setTeachersExp(j);
    } catch (e) {
      console.error("Error al obtener experiencia docente:", e);
    }
  };

  useEffect(() => {
    fetchTeachersExp();
  }, [semesterId, data]);

  const handleUpdateExp = async (email: string) => {
    const val = expEdit[email];
    if (val === undefined) return;
    const res = await fetch(`/api/admin/teachers/exp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, expPeriods: Number(val) }),
    });
    const j = await res.json();
    if (res.ok) {
      setAssignmentMessage({ type: "ok", text: `Periodos globales ${email} -> ${j.expPeriods ?? j.expYears}` });
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
      body: JSON.stringify({ email, courseCode, periods: Number(val) }),
    });
    const j = await res.json();
    if (res.ok) {
      setAssignmentMessage({ type: "ok", text: `Periodos ${email} / ${courseCode} -> ${j.exp.periods ?? j.exp.years}` });
      fetchTeachersExp();
      fetchAssignments();
    } else setAssignmentMessage({ type: "error", text: j.error });
  };

  const handleImportHistory = async () => {
    setImportHistoryLoading(true);
    setAssignmentMessage(null);
    try {
      const res = await fetch(`/api/admin/teachers/exp/import-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setAssignmentMessage({
          type: "ok",
          text: `Sincronización completada: ${j.totalPairsUpdated} registros calculados para ${j.teachersUpdated} docentes en ${j.filesProcessed.length} archivos históricos (periodos ${j.minYear}-${j.referenceYear}).`,
        });
        fetchTeachersExp();
        fetchAssignments();
      } else {
        setAssignmentMessage({ type: "error", text: j.error || "Error al sincronizar historial" });
      }
    } catch (e) {
      console.error(e);
      setAssignmentMessage({ type: "error", text: "Error de conexión al importar historial" });
    } finally {
      setImportHistoryLoading(false);
    }
  };

  const fetchHistoricalFiles = async () => {
    try {
      const res = await fetch(`/api/admin/teachers/exp/files`);
      const j = await res.json();
      if (res.ok && j.files) {
        setHistoricalFiles(j.files);
      }
    } catch (e) {
      console.error("Error al obtener archivos históricos:", e);
    }
  };

  const handleUploadHistoricalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileUploadLoading(true);
    setFileMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("autoRecalculate", "true");

      const res = await fetch(`/api/admin/teachers/exp/files`, {
        method: "POST",
        body: formData,
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setFileMessage({
          type: "ok",
          text: `${j.message} ${j.importResult ? `Se recalcularon automáticamente ${j.importResult.totalPairsUpdated} registros para ${j.importResult.teachersUpdated} docentes.` : ""}`,
        });
        fetchHistoricalFiles();
        fetchTeachersExp();
        fetchAssignments();
      } else {
        setFileMessage({ type: "error", text: j.error || "Error al subir archivo" });
      }
    } catch (err) {
      console.error(err);
      setFileMessage({ type: "error", text: "Error de conexión al subir el archivo" });
    } finally {
      setFileUploadLoading(false);
      e.target.value = "";
    }
  };

  const handleDeleteHistoricalFile = async (fileName: string) => {
    if (!confirm(`¿Eliminar '${fileName}'? Los periodos de los últimos 4 años se recalcularán automáticamente sin este archivo.`)) {
      return;
    }
    setFileUploadLoading(true);
    setFileMessage(null);
    try {
      const res = await fetch(
        `/api/admin/teachers/exp/files?fileName=${encodeURIComponent(fileName)}&autoRecalculate=true`,
        { method: "DELETE" }
      );
      const j = await res.json();
      if (res.ok && j.ok) {
        setFileMessage({
          type: "ok",
          text: `${j.message} ${j.importResult ? `Se recalcularon los registros restantes (${j.importResult.totalPairsUpdated} pares actualizados).` : ""}`,
        });
        fetchHistoricalFiles();
        fetchTeachersExp();
        fetchAssignments();
      } else {
        setFileMessage({ type: "error", text: j.error || "Error al eliminar archivo" });
      }
    } catch (err) {
      console.error(err);
      setFileMessage({ type: "error", text: "Error al eliminar archivo" });
    } finally {
      setFileUploadLoading(false);
    }
  };

  const filteredSlots = data?.slots.filter((s) => {
    if (
      filterTeacher &&
      !s.teacher.email.toLowerCase().includes(filterTeacher.toLowerCase()) &&
      !s.teacher.name.toLowerCase().includes(filterTeacher.toLowerCase()) &&
      !(s.teacher.employeeId && s.teacher.employeeId.toLowerCase().includes(filterTeacher.toLowerCase()))
    )
      return false;
    if (filterCourse) {
      const has = s.options.some((o) => String(o.courseId) === filterCourse);
      if (!has) return false;
    }
    return true;
  });

  const exportCSV = () => {
    if (!data) return;
    const rows: string[] = ["empleado_no,docente_email,docente_nombre,telefono,slot_no,materia_codigo,materia_nombre,cupo,dias,horario,ubicacion,prioridad"];
    for (const s of data.slots) {
      for (const o of s.options) {
        rows.push(
          [
            s.teacher.employeeId ?? "",
            s.teacher.email,
            s.teacher.name,
            s.teacher.phone ?? "",
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
      <AdminHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        semesters={semesters}
        activeSelectId={activeSelectId}
        onActiveSelectChange={setActiveSelectId}
        onActivateSemester={handleActivateSemester}
        activatingSemester={activatingSemester}
        onOpenNewSemesterModal={() => setShowNewSemesterModal(true)}
        coursesCount={courses.length}
        petitionsCount={data?.slots.length || 0}
        empatesCount={empates.length}
        assignmentsCount={assignments?.total || 0}
      />

      {/* Pestaña 1: Oferta & Materias + Historial 4 Años */}
      {activeTab === "setup" && (
        <AdminSetupTab
          semesters={semesters}
          importSemesterId={importSemesterId}
          onImportSemesterIdChange={setImportSemesterId}
          importFile={importFile}
          onImportFileChange={setImportFile}
          importUrl={importUrl}
          onImportUrlChange={setImportUrl}
          importMode={importMode}
          onImportModeChange={setImportMode}
          importLoading={importLoading}
          importMessage={importMessage}
          preview={preview}
          mapping={mapping}
          setMapping={setMapping}
          onPreview={handlePreview}
          onImport={handleImport}
          courses={courses}
          data={data}
          teachersExp={teachersExp}
          historicalFiles={historicalFiles}
          showFilesDrawer={showFilesDrawer}
          onToggleFilesDrawer={() => {
            setShowFilesDrawer(!showFilesDrawer);
            if (!showFilesDrawer) fetchHistoricalFiles();
          }}
          fileUploadLoading={fileUploadLoading}
          fileMessage={fileMessage}
          onDismissFileMessage={() => setFileMessage(null)}
          onUploadHistoricalFile={handleUploadHistoricalFile}
          onDeleteHistoricalFile={handleDeleteHistoricalFile}
          onImportHistory={handleImportHistory}
          importHistoryLoading={importHistoryLoading}
          expEdit={expEdit}
          onExpEditChange={(email, val) => setExpEdit((prev) => ({ ...prev, [email]: val }))}
          expCourseEdit={expCourseEdit}
          onExpCourseEditChange={(key, val) => setExpCourseEdit((prev) => ({ ...prev, [key]: val }))}
          onUpdateExp={handleUpdateExp}
          onUpdateExpCourse={handleUpdateExpCourse}
        />
      )}

      {/* Pestaña 2: Solicitudes Docentes */}
      {activeTab === "petitions" && (
        <AdminPetitionsTab
          semesters={semesters}
          semesterId={semesterId}
          onSemesterIdChange={setSemesterId}
          data={data}
          loading={loading}
          onReload={fetchAdmin}
          onExportCsv={exportCSV}
          filterTeacher={filterTeacher}
          onFilterTeacherChange={setFilterTeacher}
          filterCourse={filterCourse}
          onFilterCourseChange={setFilterCourse}
          courses={courses}
          assignments={assignments}
        />
      )}

      {/* Pestaña 3: Asignación por Slot, Empates y Rescate */}
      {activeTab === "assignment" && (
        <AdminAssignmentTab
          assignments={assignments}
          assignmentLoading={assignmentLoading}
          assignmentMessage={assignmentMessage}
          onAsignarSlot={handleAsignarSlot}
          onBorrarSlot={handleBorrarSlot}
          onFetchAssignments={fetchAssignments}
          onFetchRescueAnalysis={fetchRescueAnalysis}
          onOpenFillExcelModal={() => setShowFillExcelModal(true)}
          lastRecalculatedEvent={lastRecalculatedEvent}
          onDismissLastRecalculatedEvent={() => setLastRecalculatedEvent(null)}
          activeRescueSlot={activeRescueSlot}
          switchRescueSlot={switchRescueSlot}
          rescueAnalysis={rescueAnalysis}
          rescueLoading={rescueLoading}
          resolvedRescueCases={resolvedRescueCases}
          rescueTab={rescueTab}
          setRescueTab={setRescueTab}
          vistoBuenoConfirm={vistoBuenoConfirm}
          setVistoBuenoConfirm={setVistoBuenoConfirm}
          vacantSearch={vacantSearch}
          setVacantSearch={setVacantSearch}
          handleExecuteRescue={handleExecuteRescue}
          handleUndoRescue={handleUndoRescue}
          handleResetAllRescues={handleResetAllRescues}
          empates={empates}
          lastSlot={lastSlot}
          courses={courses}
          reassignPick={reassignPick}
          setReassignPick={setReassignPick}
          handleReassign={handleReassign}
          simulateLoading={simulateLoading}
          handleSimulate={handleSimulate}
          simulateResult={simulateResult}
          handleReassignLocked={handleReassignLocked}
          onClearSimulate={() => {
            setReassignPick({});
            setSimulateResult(null);
          }}
        />
      )}

      {/* Pestaña 4: Resultados Finales y Entrega Oficial */}
      {activeTab === "results" && (
        <AdminResultsTab
          assignments={assignments}
          assignmentSlotFilter={assignmentSlotFilter}
          onAssignmentSlotFilterChange={setAssignmentSlotFilter}
          assignmentSort={assignmentSort}
          onAssignmentSortChange={setAssignmentSort}
          courses={courses}
          lastRecalculatedEvent={lastRecalculatedEvent}
          onOpenFillExcelModal={() => setShowFillExcelModal(true)}
          onReloadAssignments={fetchAssignments}
        />
      )}

      {/* Modales Compartidos */}
      <FillExcelModal
        isOpen={showFillExcelModal}
        onClose={() => setShowFillExcelModal(false)}
        semesterId={semesterId}
        semesterLabel={semesters.find((s) => String(s.id) === semesterId)?.label || semesterId}
        onSuccessMessage={(msg) => setAssignmentMessage({ type: "ok", text: msg })}
      />

      <NewSemesterModal
        isOpen={showNewSemesterModal}
        onClose={() => setShowNewSemesterModal(false)}
        onCreated={handleSemesterCreated}
      />
    </main>
  );
}
