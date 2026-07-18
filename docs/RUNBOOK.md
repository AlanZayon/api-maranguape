# API Maranguape — Runbook

Operational notes for local development, health checks, multi-tenant ops, and migrations.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_CONNECTING_FUNCIONARIOS` | yes | MongoDB URI for main data (funcionários, setores, tenants, audit) |
| `MONGO_CONNECTING_USUARIOS` | no | Users DB URI; falls back to funcionários URI |
| `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` | yes | Redis for cache |
| `JWT_SECRET` | yes | JWT signing secret |
| `JWT_EXPIRES_IN` | no | Default `24h` |
| `CORS_ORIGINS` | no | Comma-separated extra allowed origins |
| `NODE_ENV` | no | `production` enables secure cookies |
| `LOG_LEVEL` | no | Winston level (default `info`) |
| AWS S3 vars | for uploads | As configured in `src/config/aws.js` |

## Health & metrics

- `GET /` — liveness (`{ status: 'ok' }`)
- `GET /health` — `{ status: 'healthy', uptime }`
- `GET /metrics` — in-process request counters by path/status (`metrics.getSnapshot()`)

## Auth

- Login: `POST /api/usuarios/login` → sets `authToken` httpOnly cookie
- Verify: `GET /api/usuarios/verify`
- Logout: `POST /api/usuarios/logout`
- User management (admin/superadmin): `/api/usuarios/manage`
- Roles: `user`, `readonly`, `admin`, `superadmin`

## Multi-tenant

- Header `X-Tenant-Slug` resolves tenant on public/unauthenticated flows
- Authenticated users carry `tenantId` in JWT; controllers use `req.user.tenantId || req.tenantId`
- Branding: `GET /api/tenants/by-slug/:slug` (public), `GET /api/tenants/me` (auth)
- Superadmin: `GET/POST /api/tenants`

## Tenant migration

Backfill existing data into tenant **Maranguape** (`slug: maranguape`):

```bash
npm run migrate:tenant
# or
node src/scripts/migrateTenant.js
```

Creates the tenant if missing and sets `tenantId` on documentos without one (funcionários, setores, referências, cargos, simbologias, users except existing superadmins).

## Useful endpoints

| Endpoint | Notes |
|----------|-------|
| `GET /api/dashboard/summary` | Headcount, cotas simbologia, contratos a vencer |
| `GET /api/audit` | Audit log (admin) |
| `GET /api/funcionarios/export/csv` | CSV export |
| `DELETE /api/setores/del/:id` | Blocked with 409 if funcionários linked |

## Scripts

```bash
npm run dev          # nodemon
npm test             # jest
npm run lint         # eslint (once in CI)
npm run migrate:tenant
```

## Dedicated DB per tenant (hybrid / enterprise)

Default isolation is **shared MongoDB + `tenantId`**. For large or regulated customers:

1. Provision a dedicated Mongo URI and store it on `Tenant.settings.mongoUri` (future).
2. Route repository connections by `tenantId` only for those tenants.
3. Keep Redis key prefix `tenant:{id}:` and S3 prefix `uploads/{tenantId}/` regardless of DB strategy.
4. Prefer shared DB until a tenant exceeds operational thresholds (size, compliance, noisy-neighbor).

Do not migrate all tenants to dedicated DBs by default — operational cost grows linearly.
