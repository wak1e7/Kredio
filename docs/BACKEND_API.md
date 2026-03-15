# Kredio Backend API (Base)

## Requisito de autenticacion
- Todos los endpoints (excepto `GET /api/health`) requieren sesion activa de Supabase Auth.
- La proteccion de rutas se hace via `middleware.ts`.
- Ademas, cada endpoint valida ownership del negocio (`businessId`) contra `auth.uid()`.

## 1) Health
`GET /api/health`

Respuesta:
```json
{
  "ok": true,
  "service": "kredio-api",
  "timestamp": "2026-03-11T00:00:00.000Z"
}
```

## 2) Seed de desarrollo
`POST /api/setup/dev-seed`

Body opcional (requiere login):
```json
{
  "fullName": "Owner Kredio",
  "businessName": "Kredio Demo"
}
```

Guarda el `businessId` retornado para usarlo en los demas endpoints.

## 3) Clientes
### Crear cliente
`POST /api/customers`
```json
{
  "businessId": "uuid",
  "fullName": "Maria Lopez",
  "phone": "987654321",
  "documentId": "12345678",
  "address": "Lima",
  "email": "maria@mail.com",
  "notes": "Cliente frecuente"
}
```

### Listar clientes
`GET /api/customers?businessId=<uuid>&q=maria&withDebtOnly=true`

## 4) Campanas
### Crear campana
`POST /api/campaigns`
```json
{
  "businessId": "uuid",
  "name": "Marzo 2026",
  "month": 3,
  "year": 2026,
  "startDate": "2026-03-01T00:00:00.000Z"
}
```

### Listar campanas
`GET /api/campaigns?businessId=<uuid>`

## 5) Compras
### Registrar compra
`POST /api/purchases`
```json
{
  "businessId": "uuid",
  "customerId": "uuid",
  "campaignId": "uuid",
  "purchaseDate": "2026-03-10T14:00:00.000Z",
  "items": [
    {
      "code": "SKU-001",
      "name": "Zapatos clasicos",
      "size": "38",
      "color": "Negro",
      "quantity": 1,
      "unitPrice": 120
    }
  ]
}
```

Regla aplicada:
- Si la campana esta cerrada, la compra es rechazada.

## 6) Pagos
### Registrar pago
`POST /api/payments`
```json
{
  "businessId": "uuid",
  "customerId": "uuid",
  "paymentDate": "2026-03-10T16:00:00.000Z",
  "amount": 100,
  "method": "Efectivo",
  "notes": "Abono"
}
```

Regla aplicada:
- El pago se distribuye automaticamente a las campanas mas antiguas con saldo pendiente.

### Listar pagos
`GET /api/payments?businessId=<uuid>`
