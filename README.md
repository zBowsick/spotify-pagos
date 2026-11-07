# Spotify Compartido – Control de Pagos

Aplicación completa para gestionar los pagos del plan familiar de Spotify entre 6 integrantes. Incluye panel de administración (David), paneles de miembro, subida de comprobantes, coberturas por mes, auditoría y exportación CSV.

## Stack
- **Next.js 16** (App Router, Server Actions, RSC)
- **Supabase** (PostgreSQL, Auth, Storage, RLS)
- **Tailwind CSS** (responsive, dark mode)
- **TypeScript** (estricto)

---

## Requisitos
- Node.js 20+
- Cuenta Supabase (proyecto nuevo)
- (Opcional) Cuenta Resend para emails, Stripe para cobros reales

---

## Puesta en marcha local

### 1. Clona y configura
```bash
cd spotify-pagos
cp .env.example .env
# Edita .env con tus claves de Supabase
```

### 2. Variables de entorno (`.env`)
```env
# Supabase (Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Opcional
# STRIPE_SECRET_KEY=sk_test_...
# RESEND_API_KEY=re_...
```

### 3. Base de datos
En el panel de Supabase → SQL Editor, ejecuta las migraciones **en orden**:
1. `supabase/migrations/0001_init.sql` — esquema, RLS, funciones contables, 6 integrantes preconfigurados
2. `supabase/migrations/0002_receipts_and_views.sql` — comprobantes, vistas de panel, funciones RPC

> Las migraciones crean:
> - `members` (6 filas: David admin + 5 miembros)
> - `settings` (precio mensual configurable)
> - `payments`, `payment_allocations`, `coverage_periods`
> - `audit_log` (inmutable)
> - `receipts` + bucket privado `receipts` en Storage
> - Funciones `approve_payment`, `reject_payment`, `reverse_payment` (SECURITY DEFINER, atómicas, idempotentes)
> - Vistas `admin_dashboard`, `member_dashboard`

### 4. Sembrado opcional (datos de prueba)
```bash
npm run db:seed
```
Pone precio real (~$20.900 COP), fechas de inicio y ~10 pagos de prueba aprobados.

### 5. Instala y arranca
```bash
npm install
npm run dev
# Abre http://localhost:3000
```

### 6. Primera configuración
1. Ve a `/admin` (inicia sesión como David tras vincular su `auth_user_id` — ver abajo)
2. **Configura el precio mensual** (botón "Configurar precio")
3. **Define la fecha inicial de cobertura** para cada integrante (botón "Definir fecha" en la tabla)
4. Los miembros ya pueden iniciar sesión en `/auth/login`

---

## Vincular la cuenta de David (admin)

Tras crear el usuario de David en Supabase Auth (Email/Password o Magic Link):

```sql
-- En SQL Editor de Supabase:
update members set auth_user_id = '<UUID_DE_DAVID>' where name = 'David';
```

Los otros 5 integrantes se registran solos al iniciar sesión (la app crea su sesión si el email coincide con uno permitido, o puedes pre-crear sus usuarios en Auth y actualizar `auth_user_id` igual que David).

---

## Flujo de trabajo

### Miembros (Catalina, Camila, Estevan, Angélica, Mariana)
1. Inician sesión en `/auth/login`
2. Ven su **estado** (Al día / Pendiente / Atrasado), próximo vencimiento y meses cubiertos
3. **Envían comprobante**: importe, fecha, referencia opcional, y asignan meses a uno o varios beneficiarios
4. Suben el archivo (JPG, PNG, WebP, PDF ≤ 5 MB)
5. Consultan **historial** de pagos enviados, coberturas recibidas y estado de validación

### David (Admin)
1. Panel en `/admin` con:
   - **Resumen**: total recaudado, comprobantes pendientes, integrantes, pagos del mes, coberturas activas
   - **Tabla de 6 integrantes**: rol, fecha inicio, meses asignados, pagos recibidos, recaudado, aprobado, estado, próximo vencimiento
   - **Filtros y búsqueda** en pagos (estado, pagador, fechas, texto)
   - **Acciones**: Aprobar / Rechazar (con motivo) / Revertir (con motivo, conserva historial)
   - **Configuración**: precio mensual, fechas de inicio
   - **Exportación CSV** de todos los pagos
   - **Auditoría** completa en `audit_log` (inmutable)

---

## Reglas contables (implementadas en BD y probadas)

| Regla | Implementación |
|-------|----------------|
| Solo David aprueba/rechaza/revierte | Funciones `SECURITY DEFINER` + `is_admin()` |
| Pendientes y rechazados **no** generan cobertura | `approve_payment` solo inserta en `coverage_periods` |
| Aprobar actualiza meses correctamente | Transacción con `FOR UPDATE`, salta meses ya cubiertos |
| Un pago cubre varias personas y meses | `payment_allocations` (N:M) + loop en función |
| Coberturas distintas por beneficiario | Cada allocation itera `months` veces insertando periodos |
| Parciales y excedentes | `unassigned_cop` en payments; envío rechaza si `assigned > amount` |
| Sin duplicados (aprobación repetida) | `approve_payment` es idempotente (`IF status = 'APROBADO' RETURN`) |
| Integrantes no acceden a ajenos | RLS en todas las tablas + policies |
| Reversión conserva historial | `coverage_periods.revoked_at` + `audit_log` |
| Vencimientos al cambiar de año | `period` es `date` (día 1), `addMonths` maneja año nuevo |

---

## Pruebas automatizadas

```bash
# Motor puro (ledger.ts) - 10 tests
npm test

# TypeScript strict
npm run typecheck

# Build de producción
npm run build
```

**Tests cubren:**
1. 6 integrantes, David único admin
2. Pendientes/rechazados no generan cobertura
3. Aprobar actualiza meses
4. 1 pago → 6 coberturas (varias personas × varios meses)
5. Beneficiarios con coberturas distintas en mismo pago
6. Parciales (sin asignar) y excedentes
7. Sin duplicados; detección de duplicados por referencia/pagador/importe/fecha
8. Miembro no puede aprobar/rechazar/revertir
9. Reversión conserva filas (revocadas) y auditoría
10. Vencimientos cruzan año (2026-11 → 2027-01) y zona America/Bogota

---

## Despliegue (Vercel + Supabase)

1. **Supabase**: proyecto en producción, migraciones ejecutadas, bucket `receipts` creado
2. **Vercel**: Importa el repo, añade variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (solo para scripts, no expuesta al cliente)
3. **Deploy**: Vercel detecta Next.js y compila (`output: standalone`)
4. **Dominio**: asigna tu dominio en Vercel
5. **Auth**: Configura `Site URL` y `Redirect URLs` en Supabase Auth → URL Configuration

> **Seguridad**: La `SUPABASE_SERVICE_ROLE_KEY` **nunca** se usa en el cliente. Solo en scripts (`npm run db:setup`, `db:seed`). La app usa `anon key` + RLS + funciones `SECURITY DEFINER`.

---

## Estructura del proyecto

```
├── app/
│   ├── api/              # Rutas API (Server Actions + Route Handlers)
│   ├── admin/            # Panel de David (Server Components + Client)
│   ├── dashboard/        # Panel de miembro
│   ├── auth/             # Login, callback
│   ├── globals.css       # Tailwind + design tokens
│   └── layout.tsx
├── components/
│   └── ui.tsx            # Componentes UI reutilizables
├── lib/
│   ├── actions.ts        # Server Actions (mutaciones)
│   ├── auth.ts           # Helpers de sesión
│   ├── format.ts         # COP, fechas, CSV
│   └── supabase.ts       # Clientes (browser, server, admin)
├── scripts/
│   ├── setup.ts          # Ejecuta migraciones
│   └── seed.ts           # Datos de prueba
├── src/domain/
│   ├── ledger.ts         # Motor contable puro (sin BD)
│   └── ledger.test.ts    # 10 tests (node:test)
├── supabase/migrations/
│   ├── 0001_init.sql
│   └── 0002_receipts_and_views.sql
├── .env.example
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Costes y límites

| Servicio | Plan gratuito | Coste si excedes |
|----------|---------------|------------------|
| **Supabase** | 500 MB BD, 1 GB Storage, 50k MAU | $25/mes (Pro) |
| **Vercel** | 100 GB-hours, 1 TB bandwidth | $20/mes (Pro) |
| **Resend** (opcional) | 3k emails/mes | $20/mes |
| **Stripe** (opcional) | Solo comisiones por transacción | 2.9% + $0.30 |

Para 6 usuarios y uso mensual bajo, **todo cabe en planes gratuitos**.

---

## Comandos útiles

```bash
npm run dev          # Desarrollo (Turbopack)
npm run build        # Compilación producción
npm run start        # Servidor producción
npm run test         # Tests del motor contable
npm run typecheck    # TypeScript strict
npm run db:setup     # Ejecuta migraciones (requiere SERVICE_ROLE_KEY)
npm run db:seed      # Datos de prueba
```

---

## Licencia
MIT — Uso personal para el grupo familiar de Spotify.