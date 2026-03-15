# Analisis PRD Kredio (MVP)

## 1) Objetivo de negocio
Kredio es un SaaS para pequenos comerciantes que venden a credito y necesitan controlar:
- Clientes
- Campanas mensuales
- Compras por cliente/campana
- Pagos y aplicacion automatica por antiguedad de deuda
- Reportes financieros basicos

## 2) Alcance funcional del MVP
Modulos incluidos segun PRD:
- Dashboard
- Clientes
- Campanas
- Compras
- Pagos
- Reportes
- Login (acceso por titular del negocio)
- Nota de implementacion frontend actual: productos se visualizan dentro del detalle del cliente.

Reglas clave:
- Una compra siempre pertenece a una campana.
- Una campana cerrada no admite nuevas compras.
- Los pagos se aplican a la deuda mas antigua pendiente.
- La deuda total del cliente = suma de saldos por campana.

## 3) Prioridad de construccion recomendada
1. Frontend base + diseno del dashboard (en progreso)
2. Modelo de datos Prisma + migraciones PostgreSQL (Supabase)
3. Auth y aislamiento por negocio (tenant por cuenta)
4. CRUD de clientes/campanas y productos asociados al cliente
5. Registro de compras/pagos + algoritmo de aplicacion automatica
6. Reportes y metricas
7. Storage Supabase para comprobantes/imagenes
8. Deploy en Vercel Hobby

## 4) Entidades base para la base de datos
- `users` (titular de cuenta)
- `businesses` (negocio)
- `customers`
- `campaigns`
- `products`
- `purchases`
- `purchase_items`
- `payments`
- `payment_applications` (trazabilidad de aplicacion de pago a campana)

## 5) Frontend ya implementado en esta fase
- Dashboard SaaS inspirado en la referencia visual:
  - Sidebar con navegacion por modulos
  - Topbar con busqueda, rango y perfil
  - Tarjetas KPI de cobranza/deuda
  - Bloque visual de ventas vs cobros por campana
  - Grafico de pagos semanales
  - Distribucion de deuda por categoria
  - Tabla de clientes con mayor deuda
- Responsive desktop/movil
- Accesibilidad base (focus, labels, contraste y botones claros)

## 6) Criterio de finalizacion de esta fase
- Vista dashboard funcional y compilando sin errores.
- Base visual lista para conectar datos reales desde API.
