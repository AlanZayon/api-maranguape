# API — api-maranguape

**[Português](API.md)** | **[English](API.en.md)**

REST route map. There is no Swagger/OpenAPI in this project; this page is the reference.

Local base: `http://localhost:3000`

## Conventions

| Item | Detail |
|------|--------|
| Auth | `httpOnly` cookie **`authToken`** (JWT) after login |
| Tenant | `X-Tenant-Slug` header and/or subdomain; JWT may carry `tenantId` |
| Superadmin | `X-Act-As-Tenant: <slug>` or `?actAs=<slug>` to scope |
| Content-Type | `application/json` (except multipart uploads) |
| CORS | Credentials enabled; origins via `BASE_DOMAIN` / `CORS_ORIGINS` |

Common roles: `superadmin`, `owner`, `admin`, `user`.

## Health

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/` | public |
| `GET` | `/health` | public |
| `GET` | `/metrics` | public |

```bash
curl -s http://localhost:3000/health
```

## Auth — `/api/usuarios`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/usuarios/login` | public | Login; sets cookie |
| `POST` | `/api/usuarios/logout` | session | Ends session |
| `GET` | `/api/usuarios/verify` | session | Validates cookie |

```bash
# Login (store cookie jar)
curl -s -c cookies.txt -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}' \
  http://localhost:3000/api/usuarios/login

# Verify
curl -s -b cookies.txt http://localhost:3000/api/usuarios/verify
```

### User management — `/api/usuarios/manage`

| Method | Path | Roles |
|--------|------|-------|
| `GET` | `/api/usuarios/manage` | owner, superadmin |
| `POST` | `/api/usuarios/manage` | owner, superadmin |
| `PUT` | `/api/usuarios/manage/:id` | owner, superadmin |
| `DELETE` | `/api/usuarios/manage/:id` | owner, superadmin |

## Tenants — `/api/tenants`

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/tenants/branding-policy` | public |
| `GET` | `/api/tenants/by-slug/:slug` | public |
| `GET` | `/api/tenants/me` | auth |
| `PATCH` | `/api/tenants/me` | owner, admin |
| `GET` | `/api/tenants` | superadmin |
| `POST` | `/api/tenants` | superadmin |
| `GET` | `/api/tenants/:id` | superadmin |
| `PATCH` | `/api/tenants/:id` | superadmin |
| `DELETE` | `/api/tenants/:id` | superadmin |
| `POST` | `/api/tenants/:id/assets` | owner, admin, superadmin |

```bash
curl -s http://localhost:3000/api/tenants/by-slug/maranguape
curl -s http://localhost:3000/api/tenants/branding-policy
```

## Employees — `/api/funcionarios`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/funcionarios/buscarFuncionarios` | List/filters |
| `GET` | `/api/funcionarios/para-selecao` | Lightweight options |
| `GET` | `/api/funcionarios/filtros-disponiveis` | Filter facets |
| `GET` | `/api/funcionarios/jobs/:jobId` | Bulk job status |
| `GET` | `/api/funcionarios/:id/midia` | Media links |
| `POST` | `/api/funcionarios/ids` | Fetch by IDs |
| `GET` | `/api/funcionarios/buscarFuncionariosPorSetorId/:setorId` | By department |
| `GET` | `/api/funcionarios/setores/:idSetor/funcionarios` | Staffed in department |
| `POST` | `/api/funcionarios` | Create (optional multipart) |
| `PUT` | `/api/funcionarios/edit-funcionario/:id` | Update |
| `DELETE` | `/api/funcionarios/delete-users` | Delete (sync or queue) |
| `PUT` | `/api/funcionarios/editar-lotacao-usuario` | Change placement |
| `PUT` | `/api/funcionarios/observacoes/:userId` | Notes |
| `GET` | `/api/funcionarios/buscarCargos` | Job titles |
| `GET` | `/api/funcionarios/check-name` | Name uniqueness |
| `POST` | `/api/funcionarios/export/csv` | CSV export (sync/queue) |
| `POST` | `/api/funcionarios/por-divisoes` | By divisions |
| `POST` | `/api/funcionarios/por-setores` | By departments |

```bash
curl -s -b cookies.txt -H "X-Tenant-Slug: maranguape" \
  "http://localhost:3000/api/funcionarios/buscarFuncionarios?page=1&limit=20"
```

### Reports

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/funcionarios/relatorio-funcionarios/dados` | Typed payload for the client to render the report |

## Departments — `/api/setores`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/setores` | Create |
| `GET` | `/api/setores/setoresOrganizados` | Organized tree |
| `GET` | `/api/setores/setoresMain` | Main departments |
| `GET` | `/api/setores/roots` | Roots |
| `GET` | `/api/setores/dados/:setorId` | Detail |
| `GET` | `/api/setores/:id/children` | Children |
| `PUT` | `/api/setores/rename/:id` | Rename |
| `PUT` | `/api/setores/:id/parent` | Reparent |
| `DELETE` | `/api/setores/del/:id` | Delete |

## References — `/api/referencias`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/referencias/register-reference` | Create |
| `GET` | `/api/referencias/referencias-dados` | Listing |
| `GET` | `/api/referencias/arvore` | Tree |
| `GET` | `/api/referencias/funcionario/:funcionarioId/cadeia` | Employee chain |
| `GET` | `/api/referencias/:id/ancestrais` | Ancestors |
| `GET` | `/api/referencias/:id/descendentes` | Descendants |
| `GET` | `/api/referencias/:id/impacto-exclusao` | Delete impact |
| `PATCH` | `/api/referencias/:id` | Update |
| `DELETE` | `/api/referencias/delete-referencia/:id` | Delete |

```bash
curl -s -b cookies.txt -H "X-Tenant-Slug: maranguape" \
  http://localhost:3000/api/referencias/arvore
```

## Commissioned roles — `/api/cargos-comissionados`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/cargos-comissionados` | List |
| `GET` | `/api/cargos-comissionados/template` | Excel template |
| `POST` | `/api/cargos-comissionados/import` | Import |
| `POST` | `/api/cargos-comissionados` | Create |
| `PUT` | `/api/cargos-comissionados/:id` | Update |
| `DELETE` | `/api/cargos-comissionados/:id` | Delete |

## Search — `/api/search`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/search/autocomplete` | Autocomplete |
| `GET` | `/api/search/search-funcionarios` | Text search |

## Dashboard — `/api/dashboard`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dashboard/summary` | Summary |
| `GET` | `/api/dashboard/contratos` | Expiring contracts |
| `GET` | `/api/dashboard/payroll` | Payroll / quotas |

## Audit — `/api/audit`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/audit` | Paginated log (elevated roles) |

## Useful headers

```bash
# Explicit tenant (useful from master / tooling)
-H "X-Tenant-Slug: maranguape"

# Superadmin acting as a municipality
-H "X-Act-As-Tenant: maranguape"
```

## Related

- [ARCHITECTURE.en.md](ARCHITECTURE.en.md)
- [RUNBOOK.en.md](RUNBOOK.en.md)
- [README.en.md](../README.en.md)
