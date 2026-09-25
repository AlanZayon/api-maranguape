# Organograma API

API REST multi-tenant em **ASP.NET Core 10** para gestão de RH e organograma municipal — funcionários, setores, referências políticas, cargos comissionados, dashboard e branding white-label.

[![.NET](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet)](https://dotnet.microsoft.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Driver-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-Hangfire-DC382D?logo=redis)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## O que é

Backend de produção para prefeituras e órgãos que precisam de **lotação de servidores**, **hierarquia de setores**, **cadeia de referências**, relatórios e painel operacional — com **isolamento por tenant** e personalização visual (logo, cores, CSS controlado).

O contrato HTTP é compatível com o frontend Vite/React existente (cookie `authToken`, `/api/*`, multipart e jobs bulk).

## Stack

- **ASP.NET Core 10** (LTS)
- **MongoDB** (driver oficial) — banco compartilhado com isolamento por `tenantId`
- **Redis** — cache versionado por tenant
- **Hangfire** (Mongo storage) — bulk delete/CSV
- **AWS S3** — mídia e assets de branding
- **Docker Compose** + Nginx
- OpenAPI (`/openapi/v1.json`)

## Quick start

### Docker Compose

```bash
cp .env.example .env
# Defina JWT_SECRET (e S3 se for testar uploads)
docker compose up --build
```

API em `http://localhost:3000` (ou via Nginx em `http://localhost:8080`).

### Local

Pré-requisitos: .NET 10 SDK, MongoDB e Redis.

```bash
cp .env.example .env
dotnet restore Organograma.slnx
dotnet run --project src/Organograma.Api
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `MONGO_CONNECTING_FUNCIONARIOS` | sim | URI MongoDB |
| `JWT_SECRET` | sim | Segredo JWT |
| `JWT_EXPIRES_IN` | não | Padrão `24h` |
| `REDIS_URL` | recomendado | Cache |
| `AWS_*` / `S3_BUCKET_NAME` | uploads | Credenciais S3 |
| `PORT` | não | Padrão `3000` |
| `BASE_DOMAIN` / `CORS_ORIGINS` | produção | CORS e subdomínios |

Modelo completo: [`.env.example`](.env.example).

## Estrutura

```
src/
  Organograma.Api/             # Controllers, middleware, Program.cs
  Organograma.Application/     # Services, DTOs, branding
  Organograma.Domain/          # Entities, roles, helpers
  Organograma.Infrastructure/  # Mongo, Redis, S3, Hangfire
tests/
  Organograma.UnitTests/
  Organograma.IntegrationTests/
```

## Auth e multi-tenant

- Cookie **`authToken`** (httpOnly; produção `Secure` + `SameSite=None`)
- JWT `{ id, role, username, tenantId }`
- Resolução de tenant: JWT → `X-Tenant-Slug` → subdomínio vs `BASE_DOMAIN`
- Superadmin: `X-Act-As-Tenant` / `?actAs=`

## Testes

```bash
dotnet test Organograma.slnx
```

## Seed superadmin

```bash
# Requires MONGO_CONNECTING_FUNCIONARIOS (+ optional SUPERADMIN_*)
dotnet run --project tools/SeedSuperAdmin
```

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura |
| [docs/API.md](docs/API.md) | Rotas e exemplos |
| OpenAPI | `GET /openapi/v1.json` |

## Licença

[MIT](LICENSE)
