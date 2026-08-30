# Asignación de Materias - Fase 1

Sistema de recolección de peticiones de clases por prioridad. Docentes solicitan hasta 3 slots, cada slot 3 materias con prioridad 1-3 (duplicados permitidos = empate).

## Stack
Next.js 16 + TypeScript + Tailwind + Prisma 7 + SQLite (better-sqlite3). Sin auth, identificación por email.

## Modelo de Datos (1 tabla para peticiones)
- `semesters` (id, label, year, term, isActive)
- `courses` (id, code, name, semesterId)
- `teachers` (id, email UNIQUE, name)
- `petitions` (id, teacherId, semesterId, slotNo 1-3, courseId, priority 1-3) `@@unique([teacherId,semesterId,courseId])` + `@@index([teacherId,semesterId,slotNo])` - cada fila = 1 materia de un slot (3 filas por slot). Prioridad puede repetirse.

Reglas:
- Slot 1 obligatorio: exactamente 3 materias + prioridad requerida c/u.
- Slot 2,3 opcionales: si habilitado, exactamente 3 materias + prioridad.
- No repetir materia entre slots del mismo docente/semestre.
- Prioridad 1-3 requerida, duplicada permitida.

## Instalación
```bash
npm install
npm run db:generate
npm run db:migrate  # crea prisma/dev.db
npm run db:seed     # crea semestres 2026-2 (activo) + 12 materias
npm run dev         # http://localhost:3000
npm run build && npm start # producción
```

Requiere `ADMIN_PASSWORD` en `.env`: contraseña del panel `/admin` (sin ella, las rutas `/api/admin/*` y `/admin` quedan bloqueadas con 401/redirect).

## Flujo Docente `/`
1. Ingresar email + nombre + seleccionar semestre (activo por defecto).
2. Completar Slot 1 (3 materias + prioridad c/u).
3. Opcionalmente habilitar Slot 2/3 y completar.
4. Guardar. Re-carga vía `Cargar mis peticiones` (email+semestre) para editar (upsert).

## Flujo Admin `/admin`
- Ver todas las peticiones agrupadas por docente/slot.
- Stats: total docentes/slots/opciones, demanda por materia.
- Filtros por docente y materia.
- Export CSV.

## API
- `GET /api/semesters`
- `GET /api/courses?semesterId=1`
- `GET /api/petitions?email=x&semesterId=1`
- `POST /api/petitions {email, name, semesterId, slots:[{slot_no, options:[{courseId, priority}]}]}`
- `GET /api/admin/petitions?semesterId=1`

## Migración a Postgres
Cambiar `prisma/schema.prisma` datasource provider a `postgresql`, instalar `@prisma/adapter-pg`, ajustar `DATABASE_URL` y `src/lib/prisma.ts` a `PrismaPg`.

## Próxima Fase
Regla de asignación pendiente. Tablas listas para añadir `assignments`.
