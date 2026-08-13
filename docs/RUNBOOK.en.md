# Runbook — api-maranguape

**[Português](RUNBOOK.md)** | **[English](RUNBOOK.en.md)**

Operational notes: environment, health, multi-tenant, branding, migrations, and deploy.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_CONNECTING_FUNCIONARIOS` | yes | Main MongoDB URI (employees, departments, tenants, users, audit) |
| `MONGO_CONNECTING_USUARIOS` | no | Legacy; the app boots one Mongoose connection on the employees URI |
| `JWT_SECRET` | yes | JWT secret |
| `JWT_EXPIRES_IN` | no | Default `24h` |
| `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` | recommended | Cache and BullMQ |
| `AWS_ACCESS_KEY_ID` | uploads | S3 credential |
| `AWS_SECRET_ACCESS_KEY` | uploads | S3 credential |
| `S3_BUCKET_NAME` | uploads | Bucket |
| `PORT` | no | Default `3000` |
| `NODE_ENV` | no | `production` enables secure cookies |
| `BASE_DOMAIN` | production | Apex domain for subdomain CORS |
| `CORS_ORIGINS` | no | Extra origins (CSV) |
| `BULK_WORKER_EMBEDDED` | no | `true` = worker in API (default) |
| `NEST_MIGRATED` | no | `all` (default) |
| `RATE_LIMIT_MAX` | no | Rate-limit ceiling |
| `TENANT_CUSTOM_CSS_ENABLED` | no | Enable `customCss` (default `true`) |
| `TENANT_CUSTOM_CSS_MAX_LENGTH` | no | Max CSS chars (default `20000`) |
| `TENANT_BRANDING_EDITABLE_FIELDS` | no | CSV of writable branding fields |
| `TENANT_CUSTOM_CSS_ALLOWED_SELECTORS` | no | CSV of allowed selector prefixes |
| `TENANT_FONT_URL_HOSTS` | no | Allowed hosts for `fontUrl` |
| `TENANT_BRANDING_ASSET_MAX_BYTES` | no | Max logo/favicon upload (default 2MB) |

Template: [`.env.example`](../.env.example). Minimal validation in `src/config/env.validation.ts`.

## Health and metrics

| Endpoint | Response |
|----------|----------|
| `GET /` | `{ status: 'ok' }` |
| `GET /health` | `{ status: 'healthy', uptime }` |
| `GET /metrics` | In-process counters by path/status |

## Auth (ops)

| Action | Endpoint |
|--------|----------|
| Login | `POST /api/usuarios/login` → `authToken` cookie |
| Verify | `GET /api/usuarios/verify` |
| Logout | `POST /api/usuarios/logout` |
| User management | `/api/usuarios/manage` (owner/superadmin) |

Roles: `owner`, `admin`, `user`, `superadmin` (+ `readonly` in enum). Non-superadmin **must** have `tenantId`. Superadmin may send `X-Act-As-Tenant: slug`.

## Multi-tenant

### Resolution

1. JWT `tenantId` (if authenticated)
2. `X-Tenant-Slug` header
3. Subdomain from `Origin` / `Host` / `X-Forwarded-Host`
4. Reserved hosts (`master`, `www`, `api`, `app`, …) → platform mode

### Branding and CRUD

| Endpoint | Auth | Notes |
|----------|------|-------|
| `GET /api/tenants/branding-policy` | public | Effective limits (env) |
| `GET /api/tenants/by-slug/:slug` | public | Active tenant branding |
| `GET /api/tenants/me` | auth | Current user tenant |
| `PATCH /api/tenants/me` | owner/admin | Update branding/vocabulary |
| `GET/POST /api/tenants` | superadmin | List / create (+ first owner) |
| `GET/PATCH/DELETE /api/tenants/:id` | superadmin | Detail / update / soft-deactivate |
| `POST /api/tenants/:id/assets` | owner/admin/superadmin | Upload logo/favicon (`file` + `kind`) |

Policy:

- Fields filtered by `TENANT_BRANDING_EDITABLE_FIELDS`
- `customCss` is denylisted then limited to `TENANT_CUSTOM_CSS_ALLOWED_SELECTORS`
- With `TENANT_CUSTOM_CSS_ENABLED=false`, `customCss` is omitted from payloads
- `fontUrl` must match `TENANT_FONT_URL_HOSTS`; colors must be valid CSS

### DNS / TLS (production)

1. Wildcard DNS `*.BASE_DOMAIN` → frontend
2. Wildcard TLS for `*.BASE_DOMAIN`
3. `api.BASE_DOMAIN` → API
4. `master.BASE_DOMAIN` → platform console (superadmin)
5. `{slug}.BASE_DOMAIN` → white-label tenant app

### Local development

Browsers resolve `*.localhost`:

- `http://master.localhost:5173` — master console
- `http://maranguape.localhost:5173` — Maranguape tenant

Keep `BASE_DOMAIN` empty; CORS allows `*.localhost`.

## Bulk worker

```bash
# Embedded (default)
BULK_WORKER_EMBEDDED=true
npm run dev

# Standalone (preferred under production load)
BULK_WORKER_EMBEDDED=false
npm run build
npm run prod          # terminal 1
npm run worker:bulk   # terminal 2
```

Jobs: bulk delete and CSV export. Poll: `GET /api/funcionarios/jobs/:jobId`.

## Migrations and seeds

```bash
npm run seed:superadmin
npm run migrate:tenant    # backfill tenant + tenantId
npm run verify:tenant     # fail if docs lack tenantId
npm run migrate:owners    # promote earliest admin → owner
npm run migrate:lotacao
npm run backfill:referencia-id
```

### Flow: create tenant → white-label login

1. Login as superadmin on `master.{domain}`
2. UI `/tenants/new` or `POST /api/tenants` (branding + owner)
3. Wildcard DNS already covers `*.domain`
4. Open `{slug}.{domain}` and login as owner

## Docker

```bash
docker compose up --build
```

Services: `app` (Nest), `mongo:7`, `redis`, `nginx:8080→app:3000`.

## CI / deploy

- CI: [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml) — lint, build, test (Mongo + Redis)
- Typical deploy: push to `main` → Render hook (per repo workflow)
- Cross-site cookies in production: HTTPS + `sameSite=none`

## Legacy indexes

After compound uniques, drop old global uniques if they still exist:

```js
db.funcionarios.dropIndex('nome_1')
db.users.dropIndex('username_1')
db.references.dropIndex('funcionarioId_1')
```

New indexes (Mongoose sync): `{ tenantId: 1, nome: 1 }` (employees), `{ tenantId: 1, username: 1 }` (users), `{ tenantId: 1, name: 1 }` (references), equivalents on cargos/simbologias.

## Dedicated DB per tenant (future / enterprise)

Default isolation = **shared Mongo + `tenantId`**. For large/regulated customers, a hybrid path would store a dedicated URI on `Tenant.settings` — keep Redis/S3 prefixed by tenant. Do not migrate everyone by default.

## Related

- [ARCHITECTURE.en.md](ARCHITECTURE.en.md)
- [API.en.md](API.en.md)
- [README.en.md](../README.en.md)
