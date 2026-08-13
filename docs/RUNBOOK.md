# Runbook — api-maranguape

**[Português](RUNBOOK.md)** | **[English](RUNBOOK.en.md)**

Notas operacionais: ambiente, health, multi-tenant, branding, migrações e deploy.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `MONGO_CONNECTING_FUNCIONARIOS` | sim | URI MongoDB principal (funcionários, setores, tenants, users, audit) |
| `MONGO_CONNECTING_USUARIOS` | não | Legado; a app usa uma conexão Mongoose na URI de funcionários |
| `JWT_SECRET` | sim | Segredo JWT |
| `JWT_EXPIRES_IN` | não | Padrão `24h` |
| `REDIS_URL` ou `REDIS_HOST`/`REDIS_PORT` | recomendado | Cache e BullMQ |
| `AWS_ACCESS_KEY_ID` | uploads | Credencial S3 |
| `AWS_SECRET_ACCESS_KEY` | uploads | Credencial S3 |
| `S3_BUCKET_NAME` | uploads | Bucket |
| `PORT` | não | Padrão `3000` |
| `NODE_ENV` | não | `production` ativa cookies secure |
| `BASE_DOMAIN` | produção | Domínio apex para CORS por subdomínio |
| `CORS_ORIGINS` | não | Origins extras (CSV) |
| `BULK_WORKER_EMBEDDED` | não | `true` = worker na API (padrão) |
| `NEST_MIGRATED` | não | `all` (padrão) |
| `RATE_LIMIT_MAX` | não | Teto de rate limit |
| `TENANT_CUSTOM_CSS_ENABLED` | não | Habilita `customCss` (padrão `true`) |
| `TENANT_CUSTOM_CSS_MAX_LENGTH` | não | Máx. chars CSS (padrão `20000`) |
| `TENANT_BRANDING_EDITABLE_FIELDS` | não | CSV de campos graváveis de branding |
| `TENANT_CUSTOM_CSS_ALLOWED_SELECTORS` | não | CSV de prefixos de seletor permitidos |
| `TENANT_FONT_URL_HOSTS` | não | Hosts permitidos para `fontUrl` |
| `TENANT_BRANDING_ASSET_MAX_BYTES` | não | Teto upload logo/favicon (padrão 2MB) |

Modelo: [`.env.example`](../.env.example). Validação mínima em `src/config/env.validation.ts`.

## Health e métricas

| Endpoint | Resposta |
|----------|----------|
| `GET /` | `{ status: 'ok' }` |
| `GET /health` | `{ status: 'healthy', uptime }` |
| `GET /metrics` | Contadores in-process por path/status |

## Auth (ops)

| Ação | Endpoint |
|------|----------|
| Login | `POST /api/usuarios/login` → cookie `authToken` |
| Verify | `GET /api/usuarios/verify` |
| Logout | `POST /api/usuarios/logout` |
| Gestão de usuários | `/api/usuarios/manage` (owner/superadmin) |

Papéis: `owner`, `admin`, `user`, `superadmin` (+ `readonly` no enum). Não-superadmin **deve** ter `tenantId`. Superadmin pode enviar `X-Act-As-Tenant: slug`.

## Multi-tenant

### Resolução

1. `tenantId` do JWT (se autenticado)
2. Header `X-Tenant-Slug`
3. Subdomínio de `Origin` / `Host` / `X-Forwarded-Host`
4. Hosts reservados (`master`, `www`, `api`, `app`, …) → modo plataforma

### Branding e CRUD

| Endpoint | Auth | Notas |
|----------|------|-------|
| `GET /api/tenants/branding-policy` | público | Limites efetivos (env) |
| `GET /api/tenants/by-slug/:slug` | público | Branding do tenant ativo |
| `GET /api/tenants/me` | auth | Tenant do usuário |
| `PATCH /api/tenants/me` | owner/admin | Atualiza branding/vocabulário |
| `GET/POST /api/tenants` | superadmin | Listar / criar (+ owner inicial) |
| `GET/PATCH/DELETE /api/tenants/:id` | superadmin | Detalhe / update / soft-deactivate |
| `POST /api/tenants/:id/assets` | owner/admin/superadmin | Upload logo/favicon (`file` + `kind`) |

Política:

- Campos filtrados por `TENANT_BRANDING_EDITABLE_FIELDS`
- `customCss` passa por denylist e só aceita prefixos em `TENANT_CUSTOM_CSS_ALLOWED_SELECTORS`
- Com `TENANT_CUSTOM_CSS_ENABLED=false`, `customCss` some dos payloads
- `fontUrl` deve bater com `TENANT_FONT_URL_HOSTS`; cores devem ser CSS válidas

### DNS / TLS (produção)

1. DNS wildcard `*.BASE_DOMAIN` → frontend
2. Certificado TLS wildcard para `*.BASE_DOMAIN`
3. `api.BASE_DOMAIN` → API
4. `master.BASE_DOMAIN` → console plataforma (superadmin)
5. `{slug}.BASE_DOMAIN` → app white-label do tenant

### Desenvolvimento local

Browsers resolvem `*.localhost`:

- `http://master.localhost:5173` — console master
- `http://maranguape.localhost:5173` — tenant Maranguape

Deixe `BASE_DOMAIN` vazio; CORS libera `*.localhost`.

## Worker bulk

```bash
# Embutido (padrão)
BULK_WORKER_EMBEDDED=true
npm run dev

# Standalone (recomendado em produção sob carga)
BULK_WORKER_EMBEDDED=false
npm run build
npm run prod          # terminal 1
npm run worker:bulk   # terminal 2
```

Jobs: exclusão em massa e export CSV. Poll: `GET /api/funcionarios/jobs/:jobId`.

## Migrações e seeds

```bash
npm run seed:superadmin
npm run migrate:tenant    # backfill tenant + tenantId
npm run verify:tenant     # falha se docs sem tenantId
npm run migrate:owners    # promove admin mais antigo → owner
npm run migrate:lotacao
npm run backfill:referencia-id
```

### Fluxo: criar tenant → login white-label

1. Login como superadmin em `master.{domain}`
2. UI `/tenants/new` ou `POST /api/tenants` (branding + owner)
3. DNS wildcard já cobre `*.domain`
4. Abrir `{slug}.{domain}` e logar como owner

## Docker

```bash
docker compose up --build
```

Serviços: `app` (Nest), `mongo:7`, `redis`, `nginx:8080→app:3000`.

## CI / deploy

- CI: [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml) — lint, build, test (Mongo + Redis)
- Deploy típico: push em `main` → hook Render (conforme workflow do repositório)
- Cookies cross-site em produção: HTTPS + `sameSite=none`

## Índices legados

Após uniques compostos, drope uniques globais antigos se ainda existirem:

```js
db.funcionarios.dropIndex('nome_1')
db.users.dropIndex('username_1')
db.references.dropIndex('funcionarioId_1')
```

Índices novos (sync Mongoose): `{ tenantId: 1, nome: 1 }` (funcionários), `{ tenantId: 1, username: 1 }` (users), `{ tenantId: 1, name: 1 }` (references), equivalentes em cargos/simbologias.

## DB dedicado por tenant (futuro / enterprise)

Isolamento padrão = **Mongo compartilhado + `tenantId`**. Para clientes grandes/regulados, um caminho híbrido seria URI dedicada em `Tenant.settings` — manter Redis/S3 prefixados por tenant. Não migrar todos por padrão.

## Relacionado

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [API.md](API.md)
- [README.md](../README.md)
