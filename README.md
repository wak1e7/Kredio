# Kredio SaaS

Frontend y backend en un solo proyecto con Next.js, preparado para PostgreSQL (Supabase), Prisma y despliegue en Vercel Hobby.

## Stack
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4
- Prisma 7
- Supabase Postgres + Storage
- Vercel Hobby

## Estado actual
- Frontend completo segun PRD implementado (solo UI, sin logica de backend):
  - `/dashboard`
  - `/clientes`
  - `/clientes/[id]`
  - `/clientes/[id]/campanas/[campaignId]`
  - `/campanas`
  - `/compras`
  - `/pagos`
  - `/reportes`
  - `/configuracion`
  - `/login`
  - `/registro`
  - `/recuperar-acceso`
- Productos integrados en detalle de cada cliente (`/clientes/[id]`)
- Analisis del PRD en: `docs/PRD_ANALISIS_MVP.md`.
- Guia de endpoints backend: `docs/BACKEND_API.md`.
- Backend base implementado:
  - Prisma schema en `prisma/schema.prisma`
  - Migracion inicial en `prisma/migrations/202603110001_init/migration.sql`
  - RLS + trigger auth en `supabase/migrations/202603110002_auth_rls.sql`
  - Auth real con Supabase (login/logout, recuperacion y proteccion de rutas)
  - Endpoints API:
    - `/api/health`
    - `/api/customers`
    - `/api/campaigns`
    - `/api/purchases`
    - `/api/payments`
    - `/api/setup/dev-seed`

## Ejecutar en local
```bash
npm install
npm run dev
```

Abrir: `http://localhost:3000`

## Configuracion backend (Supabase)
1. Completa tu `DATABASE_URL` real en `.env` (password de la base Supabase).
   - Si en Windows/red corporativa ves `self-signed certificate in certificate chain`, agrega:
   - `PG_SSL_REJECT_UNAUTHORIZED=false`
2. Genera cliente Prisma:
```bash
npm run prisma:generate
```
3. Aplica esquema:
```bash
npm run prisma:push
```
4. Ejecuta SQL de RLS/trigger:
   - Abre Supabase SQL Editor y corre `supabase/migrations/202603110002_auth_rls.sql`
5. En Supabase Auth > URL Configuration agrega:
   - Site URL: `http://localhost:3000`
   - Redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/auth/update-password`
6. Levanta app:
```bash
npm run dev
```

## Flujo profesional recomendado
1. Crear repositorio git:
```bash
git init
git add .
git commit -m "feat: implement full PRD frontend screens"
```
2. Construir modelo de datos con Prisma.
3. Conectar Prisma a Supabase PostgreSQL.
4. Implementar autenticacion y reglas de negocio.
5. Desplegar en Vercel Hobby.

## Scripts
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:migrate`
- `npm run prisma:studio`
