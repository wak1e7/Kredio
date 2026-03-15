# Despliegue en Vercel

## 1. Preparar Supabase
Antes de desplegar, verifica en Supabase:

- `Authentication > URL Configuration`
  - `Site URL`: URL final de Vercel
  - `Redirect URLs`:
    - `https://<tu-dominio>/auth/callback`
    - `https://<tu-dominio>/auth/update-password`
- `Authentication > Providers > Email`
  - habilitado
- `Authentication > Password security`
  - activa `Leaked password protection` si tu plan lo permite

## 2. Variables de entorno en Vercel
Configura estas variables en el proyecto:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

No configures `PG_SSL_REJECT_UNAUTHORIZED` en Vercel salvo que realmente lo necesites.

## 3. Build y runtime
Vercel detecta Next.js automáticamente. No hace falta un `vercel.json` especial para este proyecto.

Comandos esperados:
- Install: `npm install`
- Build: `npm run build`

## 4. Base de datos
La base actual quedó limpia para producción:

- sin clientes
- sin campañas
- sin compras
- sin pagos
- sin gastos
- con un solo usuario administrador final

## 5. Verificación final
Antes de publicar, prueba:

1. `npm run lint`
2. `npm run build`
3. Inicio de sesión
4. Recuperación de contraseña
5. Navegación completa sin datos de ejemplo

## 6. Recomendación operativa
Haz el primer despliegue con una rama limpia y evita subir credenciales reales al repositorio. Las claves deben quedarse solo en las variables de entorno de Vercel y Supabase.
