# API — api-maranguape

**[Português](API.md)** | **[English](API.en.md)**

Mapa de rotas da API REST. Não há Swagger/OpenAPI no projeto; esta página é a referência.

Base local: `http://localhost:3000`

## Convenções

| Item | Detalhe |
|------|---------|
| Auth | Cookie `httpOnly` **`authToken`** (JWT) após login |
| Tenant | Header `X-Tenant-Slug` e/ou subdomínio; JWT pode carregar `tenantId` |
| Superadmin | `X-Act-As-Tenant: <slug>` ou `?actAs=<slug>` para escopar |
| Content-Type | `application/json` (exceto multipart em uploads) |
| CORS | Credentials habilitados; origins via `BASE_DOMAIN` / `CORS_ORIGINS` |

Papéis frequentes: `superadmin`, `owner`, `admin`, `user`.

## Health

| Método | Path | Auth |
|--------|------|------|
| `GET` | `/` | público |
| `GET` | `/health` | público |
| `GET` | `/metrics` | público |

```bash
curl -s http://localhost:3000/health
```

## Auth — `/api/usuarios`

| Método | Path | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/api/usuarios/login` | público | Login; seta cookie |
| `POST` | `/api/usuarios/logout` | sessão | Encerra sessão |
| `GET` | `/api/usuarios/verify` | sessão | Valida cookie |

```bash
# Login (salva cookie em jar)
curl -s -c cookies.txt -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secret"}' \
  http://localhost:3000/api/usuarios/login

# Verify
curl -s -b cookies.txt http://localhost:3000/api/usuarios/verify
```

### Gestão de usuários — `/api/usuarios/manage`

| Método | Path | Roles |
|--------|------|-------|
| `GET` | `/api/usuarios/manage` | owner, superadmin |
| `POST` | `/api/usuarios/manage` | owner, superadmin |
| `PUT` | `/api/usuarios/manage/:id` | owner, superadmin |
| `DELETE` | `/api/usuarios/manage/:id` | owner, superadmin |

## Tenants — `/api/tenants`

| Método | Path | Auth |
|--------|------|------|
| `GET` | `/api/tenants/branding-policy` | público |
| `GET` | `/api/tenants/by-slug/:slug` | público |
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

## Funcionários — `/api/funcionarios`

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/api/funcionarios/buscarFuncionarios` | Lista/filtros |
| `GET` | `/api/funcionarios/para-selecao` | Opções leves |
| `GET` | `/api/funcionarios/filtros-disponiveis` | Facetas de filtro |
| `GET` | `/api/funcionarios/jobs/:jobId` | Status de job bulk |
| `GET` | `/api/funcionarios/:id/midia` | Links de mídia |
| `POST` | `/api/funcionarios/ids` | Busca por IDs |
| `GET` | `/api/funcionarios/buscarFuncionariosPorSetorId/:setorId` | Por setor |
| `GET` | `/api/funcionarios/setores/:idSetor/funcionarios` | Lotados no setor |
| `POST` | `/api/funcionarios` | Criar (multipart opcional) |
| `PUT` | `/api/funcionarios/edit-funcionario/:id` | Editar |
| `DELETE` | `/api/funcionarios/delete-users` | Exclusão (sync ou fila) |
| `PUT` | `/api/funcionarios/editar-lotacao-usuario` | Alterar lotação |
| `PUT` | `/api/funcionarios/observacoes/:userId` | Observações |
| `GET` | `/api/funcionarios/buscarCargos` | Cargos |
| `GET` | `/api/funcionarios/check-name` | Unicidade de nome |
| `POST` | `/api/funcionarios/export/csv` | Export CSV (sync/fila) |
| `POST` | `/api/funcionarios/por-divisoes` | Por divisões |
| `POST` | `/api/funcionarios/por-setores` | Por setores |

```bash
curl -s -b cookies.txt -H "X-Tenant-Slug: maranguape" \
  "http://localhost:3000/api/funcionarios/buscarFuncionarios?page=1&limit=20"
```

### Relatórios

| Método | Path | Descrição |
|--------|------|-----------|
| `POST` | `/api/funcionarios/relatorio-funcionarios/dados` | Payload tipado para o front gerar o relatório |

## Setores — `/api/setores`

| Método | Path | Descrição |
|--------|------|-----------|
| `POST` | `/api/setores` | Criar |
| `GET` | `/api/setores/setoresOrganizados` | Árvore organizada |
| `GET` | `/api/setores/setoresMain` | Setores principais |
| `GET` | `/api/setores/roots` | Raízes |
| `GET` | `/api/setores/dados/:setorId` | Detalhe |
| `GET` | `/api/setores/:id/children` | Filhos |
| `PUT` | `/api/setores/rename/:id` | Renomear |
| `PUT` | `/api/setores/:id/parent` | Reparent |
| `DELETE` | `/api/setores/del/:id` | Excluir |

## Referências — `/api/referencias`

| Método | Path | Descrição |
|--------|------|-----------|
| `POST` | `/api/referencias/register-reference` | Criar |
| `GET` | `/api/referencias/referencias-dados` | Listagem |
| `GET` | `/api/referencias/arvore` | Árvore |
| `GET` | `/api/referencias/funcionario/:funcionarioId/cadeia` | Cadeia do funcionário |
| `GET` | `/api/referencias/:id/ancestrais` | Ancestrais |
| `GET` | `/api/referencias/:id/descendentes` | Descendentes |
| `GET` | `/api/referencias/:id/impacto-exclusao` | Impacto |
| `PATCH` | `/api/referencias/:id` | Atualizar |
| `DELETE` | `/api/referencias/delete-referencia/:id` | Excluir |

```bash
curl -s -b cookies.txt -H "X-Tenant-Slug: maranguape" \
  http://localhost:3000/api/referencias/arvore
```

## Cargos comissionados — `/api/cargos-comissionados`

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/api/cargos-comissionados` | Listar |
| `GET` | `/api/cargos-comissionados/template` | Template Excel |
| `POST` | `/api/cargos-comissionados/import` | Importar |
| `POST` | `/api/cargos-comissionados` | Criar |
| `PUT` | `/api/cargos-comissionados/:id` | Atualizar |
| `DELETE` | `/api/cargos-comissionados/:id` | Excluir |

## Busca — `/api/search`

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/api/search/autocomplete` | Autocomplete |
| `GET` | `/api/search/search-funcionarios` | Busca textual |

## Dashboard — `/api/dashboard`

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/api/dashboard/summary` | Resumo |
| `GET` | `/api/dashboard/contratos` | Contratos a vencer |
| `GET` | `/api/dashboard/payroll` | Folha / cotas |

## Auditoria — `/api/audit`

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/api/audit` | Log paginado (papéis elevados) |

## Headers úteis

```bash
# Tenant explícito (útil em master / ferramentas)
-H "X-Tenant-Slug: maranguape"

# Superadmin atuando como município
-H "X-Act-As-Tenant: maranguape"
```

## Relacionado

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [RUNBOOK.md](RUNBOOK.md)
- [README.md](../README.md)
