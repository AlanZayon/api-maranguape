# Arquitetura da API

## Camadas (atuais)

```
HTTP → routes → controllers → services → repositories → models
                 ↑
            middlewares (auth, tenant, validate, errors)
```

Cross-cutting: `config/`, `utils/`, `services/CacheService.js`, `scripts/`

## Domínios

| Domínio | Rotas | Responsabilidade |
|---------|-------|------------------|
| auth | `/api/usuarios` | login, sessão, gestão de users |
| setores | `/api/setores` | hierarquia / organograma |
| funcionarios | `/api/funcionarios` | CRUD, cotas, PDF, CSV |
| search | `/api/search` | autocomplete / busca |
| referencias | `/api/referencias` | catálogo de referências |
| tenants | `/api/tenants` | multi-tenant / branding |
| dashboard | `/api/dashboard` | métricas agregadas |
| audit | `/api/audit` | log de ações |

Registro central: [`src/modules/registerRoutes.js`](src/modules/registerRoutes.js)

## Evolução recomendada

Ao mexer em um domínio, migrar seus arquivos para:

```
src/modules/<dominio>/
  *.routes.js
  *.controller.js
  *.service.js
  *.repository.js
  *.model.js
  *.validation.js
```

Evitar big-bang: um domínio por PR.
