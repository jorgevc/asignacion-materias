import type { RescueAnalysisResult } from "@/lib/asignador";

export type Course = {
  id: number;
  code: string;
  name: string;
  cupo: number | null;
  dias: string | null;
  horario: string | null;
  ubicacion: string | null;
};

export type Teacher = {
  id: number;
  email: string;
  name: string;
  employeeId?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

export type TeacherCourseExp = {
  courseCode: string;
  periods: number;
  years?: number;
};

export type TeacherWithExps = Teacher & {
  expPeriods?: number;
  expYears?: number;
  exps?: TeacherCourseExp[];
};

export type Slot = {
  slot_no: number;
  teacher: Teacher;
  options: { courseId: number; course: Course; priority: number }[];
  createdAt: string;
};

export type AdminData = {
  semesterId: number;
  totalTeachers: number;
  totalSlots: number;
  totalOptions: number;
  statsByCourse: { courseId: number; course: Course; count: number }[];
  slots: Slot[];
};

export type Semester = {
  id: number;
  label: string;
  isActive: boolean;
  year?: number;
  term?: string;
};

export type ResolvedRescueRecord = {
  teacherId: number;
  teacherName: string;
  optionLabel: string;
  description: string;
  assignedCourseSummary: string;
  locked: Array<{ courseId: number; teacherId: number }>;
  timestamp: string;
};

export type RecalculatedTeacherDetail = {
  teacherId: number;
  teacherName: string;
  courseCode: string;
  courseName: string;
  priority: number;
  puntaje: number;
  detalle?: {
    base: number;
    desplazamiento: number;
    flexibilidad: number;
    experiencia: number;
    periodos?: number;
    total: number;
  };
};

export type LastRecalculatedEvent = {
  slotNo: number;
  actionTitle: string;
  timestamp: string;
  affectedTeachers: RecalculatedTeacherDetail[];
  stats?: {
    totalAsignados: number;
    cursosRestantes: number;
    p1Count: number;
    p2Count: number;
    p3Count: number;
    avgPuntaje: number;
  };
};

export type HistoricalFile = {
  name: string;
  sizeFormatted: string;
  updatedAt: string;
  extension: string;
};

export type AssignmentItem = {
  id: number;
  teacherId: number;
  courseId: number;
  slotNo: number;
  priority: number;
  puntaje: number;
  detalle: any;
  teacher: Teacher & { expPeriods?: number; expYears?: number };
  course: Course;
};

export type AssignmentsState = {
  total: number;
  assignments: AssignmentItem[];
};

export type TieGroup = {
  courseId: number;
  courseCode: string;
  courseName: string;
  priority: number;
  puntaje: number;
  tied: Array<{ teacherId: number; teacherName: string; puntaje: number; petitionId: number }>;
};

export const FIELD_OPTIONS = [
  { value: "", label: "-- ignorar --" },
  { value: "code", label: "code" },
  { value: "name", label: "name" },
  { value: "cupo", label: "cupo" },
  { value: "dias", label: "dias" },
  { value: "horario", label: "horario" },
  { value: "ubicacion", label: "ubicacion" },
];
