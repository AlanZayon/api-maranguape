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
| `BASE_DOMAIN` | prod | Apex domain for subdomain CORS (ex: `seudominio.com`) |
| `CORS_ORIGINS` | no | Comma-separated extra allowed origins |
| `NODE_ENV` | no | `production` enables secure cookies |
| `LOG_LEVEL` | no | Winston level (default `info`) |
| AWS S3 vars | for uploads | As configured in `src/config/aws.js` |
| `TENANT_CUSTOM_CSS_ENABLED` | no | Enable tenant `customCss` (default `true`) |
| `TENANT_CUSTOM_CSS_MAX_LENGTH` | no | Max CSS chars (default `20000`) |
| `TENANT_BRANDING_EDITABLE_FIELDS` | no | CSV of writable branding keys |
| `TENANT_CUSTOM_CSS_ALLOWED_SELECTORS` | no | CSV of allowed CSS selector prefixes |
| `TENANT_FONT_URL_HOSTS` | no | CSV of allowed `fontUrl` hosts |
| `TENANT_BRANDING_ASSET_MAX_BYTES` | no | Max logo/favicon upload size (default 2MB) |

## Health & metrics

- `GET /` — liveness (`{ status: 'ok' }`)
- `GET /health` — `{ status: 'healthy', uptime }`
- `GET /metrics` — in-process request counters by path/status (`metrics.getSnapshot()`)

## Auth

- Login: `POST /api/usuarios/login` → sets `authToken` httpOnly cookie
- Verify: `GET /api/usuarios/verify`
- Logout: `POST /api/usuarios/logout`
- User management (owner/superadmin): `/api/usuarios/manage`
- Tenant roles: `owner` (full access), `admin` (tudo exceto usuários), `user` (estrutura/funcionários)
- Platform role: `superadmin`
- Also in enum (unused in routes): `readonly`
- Non-superadmin users **must** have `tenantId` (fail-closed)
- Superadmin may send `X-Act-As-Tenant: slug` to scope requests

## Multi-tenant

### Resolution order

1. Header `X-Tenant-Slug` (frontend sends subdomain slug)
2. Subdomain from `Origin` / `Host` / `X-Forwarded-Host`
3. Reserved hosts (`master`, `www`, `api`, `app`, …) → platform mode (no municipal tenant)

### Branding & CRUD

| Endpoint | Auth | Notes |
|----------|------|-------|
| `GET /api/tenants/branding-policy` | public | Effective branding limits (env-driven) |
| `GET /api/tenants/by-slug/:slug` | public | Active tenant branding |
| `GET /api/tenants/me` | auth | Current user tenant |
| `PATCH /api/tenants/me` | owner/admin | Update own branding/vocabulary |
| `GET/POST /api/tenants` | superadmin | List / create (+ first owner + seed) |
| `GET/PATCH/DELETE /api/tenants/:id` | superadmin | Detail / update / soft-deactivate |
| `POST /api/tenants/:id/assets` | owner/admin/superadmin | Upload logo/favicon (`file` + `kind`) |

Branding supports: logo/favicon, colors, header/sidebar, fonts, `themeMode`, `customCss`, vocabulary.

Policy notes:
- Writable fields are filtered by `TENANT_BRANDING_EDITABLE_FIELDS`.
- `customCss` is denylisted (script/expression/@import/…) then filtered to `TENANT_CUSTOM_CSS_ALLOWED_SELECTORS` prefixes (e.g. `.login-page`, `.sidebar`, `.dashboard-page`, `.dashboard-stat`).
- When `TENANT_CUSTOM_CSS_ENABLED=false`, `customCss` is omitted from API payloads and updates are ignored.
- `fontUrl` must match `TENANT_FONT_URL_HOSTS`. Colors must be valid CSS color strings.
- Future hardening: CSP on the frontend for injected styles.

### DNS / TLS (production)

1. Wildcard DNS `*.BASE_DOMAIN` → frontend
2. Wildcard TLS certificate for `*.BASE_DOMAIN`
3. `api.BASE_DOMAIN` → API
4. `master.BASE_DOMAIN` → platform console (superadmin)
5. `{slug}.BASE_DOMAIN` → white-label app for that tenant

### Local development

Browsers resolve `*.localhost`. Examples:

- `http://master.localhost:5173` — console master
- `http://maranguape.localhost:5173` — tenant Maranguape
- Dev fallback: `?tenant=slug` or `VITE_TENANT_SLUG`

Set API `BASE_DOMAIN=` empty locally; CORS allows `*.localhost`.

## Tenant migration & verify

```bash
npm run migrate:tenant   # backfill tenant maranguape + tenantId
npm run verify:tenant    # fail if docs still lack tenantId
```

## Flow: create tenant → login white-label

1. Login as superadmin on `master.{domain}`
2. UI `/tenants/new` or `POST /api/tenants` with branding + first owner
3. DNS already covers `*.domain` (wildcard)
4. Open `{slug}.{domain}` and login as tenant owner

## Scripts

```bash
npm run dev
npm test
npm run lint
npm run migrate:tenant
npm run migrate:owners   # promote earliest admin per tenant → owner
npm run verify:tenant
```

## Dedicated DB per tenant (hybrid / enterprise)

Default isolation is **shared MongoDB + `tenantId`**. For large or regulated customers:

1. Provision a dedicated Mongo URI and store it on `Tenant.settings.mongoUri` (future).
2. Route repository connections by `tenantId` only for those tenants.
3. Keep Redis key prefix `tenant:{id}:` and S3 prefix `uploads/{tenantId}/` regardless of DB strategy.
4. Prefer shared DB until a tenant exceeds operational thresholds.

Do not migrate all tenants to dedicated DBs by default — operational cost grows linearly.

## Index migration notes

After deploying compound unique indexes, drop legacy global uniques if they still exist:

```js
// Mongo shell / Compass
db.funcionarios.dropIndex('nome_1')
db.users.dropIndex('username_1')
db.references.dropIndex('funcionarioId_1')
```

New indexes (created by Mongoose sync):
- `funcionarios`: `{ tenantId: 1, nome: 1 }` unique
- `users`: `{ tenantId: 1, username: 1 }` unique
- `references`: `{ tenantId: 1, name: 1 }` unique
- `cargocomissionados`: `{ tenantId: 1, cargo: 1 }` unique
- `simbologias`: `{ tenantId: 1, simbologia: 1 }` unique

