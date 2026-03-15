# Kredio

Kredio es un SaaS para control de ventas al crédito por campañas mensuales. Está construido con Next.js, Prisma y Supabase, listo para desplegarse en Vercel.

## Stack
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4
- Prisma 7
- Supabase Auth + PostgreSQL
- Vercel Hobby

## Variables de entorno
Usa como base el archivo `.env.example`.

Variables requeridas:
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

Variables opcionales:
- `PG_SSL_REJECT_UNAUTHORIZED`
- `ENABLE_PUBLIC_REGISTRATION`
- `ENABLE_DEV_SEED`

## Desarrollo local
```bash
npm install
npm run prisma:generate
npm run dev
```

Abre `http://localhost:3000`.

## Despliegue en Vercel
La guía completa está en [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md).

## Scripts
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:migrate`
- `npm run prisma:studio`
