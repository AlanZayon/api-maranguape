# Checklist de produção

Guia para colocar a API (Render) + front (Vercel) + MongoDB em produção com dados de demonstração.

## Ordem recomendada

1. MongoDB (Atlas ou self-hosted) — banco vazio ok
2. Redis (Render Redis / Upstash / outro)
3. Deploy da API no Render
4. Rodar seed (`SeedDemo`) apontando para o Mongo de produção
5. Deploy do front na Vercel com env de build
6. Validar login e fluxos por papel

---

## 1. MongoDB

- Crie um cluster e um usuário com senha forte.
- Connection string no formato:
  `mongodb+srv://USER:PASS@HOST/funcionarios?retryWrites=true&w=majority`
- O nome do database vem do path da URI (`funcionarios` no exemplo).
- Libere o IP do Render (ou `0.0.0.0/0` se aceitável temporariamente).
- Indexes são criados automaticamente no startup da API (`IndexSyncHostedService`).

Atlas Search (opcional): autocomplete fica melhor com índices de search; sem eles a API usa fallback por regex.

---

## 2. Redis

Defina `REDIS_URL`. Se Redis estiver indisponível, a API degrada (sem cache), mas Hangfire/jobs bulk ficam piores. Em produção, use Redis.

Para desligar Hangfire temporariamente: `DISABLE_HANGFIRE=true`.

---

## 3. API no Render

O CI em `.github/workflows/ci-cd.yml` dispara deploy no serviço Render após push em `main` (secret `RENDER_API_KEY`).

### Variáveis obrigatórias / importantes

| Variável | Valor |
|----------|--------|
| `MONGO_CONNECTING_FUNCIONARIOS` | URI do Mongo |
| `JWT_SECRET` | string longa e aleatória |
| `JWT_EXPIRES_IN` | `24h` (ou o desejado) |
| `REDIS_URL` | URI Redis |
| `NODE_ENV` | `production` (cookies `Secure` + `SameSite=None`) |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `PORT` | Render injeta; a API lê `PORT` |
| `BASE_DOMAIN` | domínio do front, ex. `seudominio.com` |
| `CORS_ORIGINS` | origens extras CSV, ex. `https://app.seudominio.com,https://seu-front.vercel.app` |

### Uploads (opcional)

`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME` — sem isso, mídia/branding upload fica desabilitado (`NullS3Service`).

### Cookies cross-site (Vercel ↔ Render)

Login usa cookie `authToken`. Em produção precisa:

- Front em HTTPS
- API em HTTPS
- `NODE_ENV=production`
- CORS com credentials e origem exata do front
- Se usar subdomínios de tenant (`demo.seudominio.com`), configure DNS + `BASE_DOMAIN` / `VITE_BASE_DOMAIN`

Se o front e a API estão em domínios diferentes (ex. `*.vercel.app` e `*.onrender.com`), cookies cross-site dependem de `SameSite=None; Secure` — já ativado via `NODE_ENV=production`. Inclua **todas** as origens do front em `CORS_ORIGINS`.

### Health

Após o deploy: `GET https://SUA-API.onrender.com/health` (ou a rota de health exposta).

---

## 4. Seed de demonstração

Com o Mongo de produção acessível da sua máquina (ou de um one-off no Render):

```bash
cd api-maranguape
# .env com MONGO_CONNECTING_FUNCIONARIOS apontando para PRODUÇÃO
dotnet run --project tools/SeedDemo
```

Recriar do zero o tenant demo:

```bash
dotnet run --project tools/SeedDemo -- --reset
```

### Contas criadas (padrão)

| Onde | ID de login | Senha padrão | Papel |
|------|-------------|--------------|--------|
| `master.*` | `superadmin` | `change_me` (`SUPERADMIN_PASSWORD`) | superadmin |
| `demo.*` | `owner-demo` | `Demo@2026` | owner |
| `demo.*` | `admin-demo` | `Demo@2026` | admin |
| `demo.*` | `user-demo` | `Demo@2026` | user |
| `demo.*` | `readonly-demo` | `Demo@2026` | readonly |

**Troque as senhas** depois da demo (`SUPERADMIN_PASSWORD` / `DEMO_PASSWORD` antes do seed, ou altere no banco/API).

### O que o seed preenche

- Tenant `demo` (slug configurável via `DEMO_TENANT_SLUG`)
- 5 secretarias + 12 subsetores
- Cotas de simbologia + cargos comissionados
- ~76 funcionários (EFETIVO / TEMPORARIO / COMISSIONADO)
- Contratos temporários a vencer (dashboard)
- Árvore de referências (externas + vinculadas)
- Alguns audit logs

Apenas superadmin (sem dados de tenant):

```bash
dotnet run --project tools/SeedSuperAdmin
```

---

## 5. Front na Vercel

Build: `npm run build` (Vite). `vercel.json` já faz SPA rewrite.

### Environment Variables (Build)

| Variável | Exemplo |
|----------|---------|
| `VITE_API_BASE_URL` | `https://sua-api.onrender.com` |
| `VITE_BASE_DOMAIN` | `seudominio.com` (vazio se ainda não usar subdomínio) |
| `VITE_MASTER_SUBDOMAIN` | `master` |

`VITE_*` entram no bundle no **build** — mude a variável e faça **redeploy**.

### Domínio / multi-tenant

- Ideal: `master.seudominio.com` (console) e `demo.seudominio.com` (tenant).
- Alternativa temporária: um único host Vercel + header `X-Tenant-Slug` (o front já envia com base no hostname; em host único use `?tenant=demo` em DEV — em prod prefira subdomínio).

DNS: CNAME dos subdomínios para a Vercel; API no Render.

---

## 6. Validação rápida pós-deploy

1. `master` + `superadmin` → lista de tenants, abrir `demo`
2. `owner-demo` → dashboard (KPIs, cotas, contratos, payroll, audit)
3. `admin-demo` → dashboard ok, `/usuarios` bloqueado
4. `user-demo` → cai em `/estrutura`, sem admin nav
5. Criar/editar funcionário e setor conforme o papel
6. Logout / login de novo (cookie)

---

## 7. Segurança pós-demo

- Rotacionar `JWT_SECRET` e senhas demo
- Restringir IP do Mongo
- Proteger `/hangfire` (hoje aberto a quem alcança a URL — restrinja por rede/auth no Render)
- Não commitiar `.env` com URI de produção
