# Sistema de Gestão de Funcionários — API

API REST para gerenciamento de funcionários, setores, autenticação, busca/autocomplete e geração de relatórios da Prefeitura Municipal de Maranguape.

Interface web (demo): https://interface-sistema-maranguape.vercel.app/


## Sumário
- Visão Geral
- Tecnologias
- Arquitetura
- Requisitos
- Instalação e Execução
  - Local
  - Docker/Docker Compose
- Variáveis de Ambiente
- Estrutura do Projeto
- Rotas da API
  - Autenticação
  - Funcionários
  - Setores
  - Busca
  - Referências
  - Relatórios
- Cache
- Uploads e Arquivos
- Testes
- Qualidade de Código
- Licença

---

## Visão Geral
Esta API fornece:
- Autenticação via JWT armazenado em cookie HTTP-only.
- CRUD e consultas paginadas de funcionários.
- Organização hierárquica de setores (Setor, Subsetor, Coordenadoria).
- Busca/autocomplete com MongoDB Atlas Search e text index.
- Geração de relatórios em PDF (ex.: salarial, por referências, por localidade, geral).
- Cache de dados com Redis para melhor desempenho.
- Upload de arquivos para AWS S3 (fotos e PDFs).


## Tecnologias
- Node.js, Express
- MongoDB/Mongoose (conexões separadas para funcionários e usuários)
- Redis (ioredis)
- JWT para autenticação
- Joi para validações
- Multer para upload (memória)
- AWS SDK v3 (S3)
- PDFKit para relatórios
- Helmet, CORS, rate limiting, morgan
- Jest e Supertest para testes


## Arquitetura
Camadas e responsabilidades:
- routes: definição das rotas e mapeamento para controllers.
- controllers: lidam com HTTP e delegam a services.
- services: regras de negócio, composição de repositórios e utilitários.
- repositories: acesso a dados (Mongoose) e integrações de baixo nível.
- models: schemas do Mongoose.
- middlewares: validações e proteção (ex.: Joi).
- utils: utilitários transversais (AWS S3, logger, etc.).
- config: conexões (MongoDB, Redis), multer, AWS S3.


## Requisitos
- Node.js 18+ (a imagem Docker usa Node 20)
- MongoDB 4.4+
- Redis 6+
- AWS S3 (para armazenamento de arquivos)


## Instalação e Execução
### 1) Local
```bash
# Clonar
git clone https://github.com/AlanZayon/api-maranguape.git
cd api-maranguape

# Instalar dependências
npm install

# Configurar variáveis de ambiente
# Crie um arquivo .env na raiz do projeto (veja seção "Variáveis de Ambiente")

# Executar em desenvolvimento
npm run dev
# ou em produção
npm run prod
```
- Servidor padrão: http://localhost:3000

### 2) Docker/Docker Compose
Pré-requisitos: Docker e Docker Compose instalados.

```bash
# Subir os serviços (app, redis e nginx)
docker-compose up --build
```
- Acesso via Nginx: http://localhost:8080 (proxy para o app:3000)

> Observação: o serviço app lê variáveis de ambiente do host conforme docker-compose.yml.


## Variáveis de Ambiente
Crie um arquivo .env na raiz do projeto:

```ini
# Banco de Dados
MONGO_CONNECTING_FUNCIONARIOS=mongodb://localhost:27017/funcionarios
MONGO_CONNECTING_USUARIOS=mongodb://localhost:27017/usuarios

# Autenticação
JWT_SECRET=sua_chave_secreta_jwt
JWT_EXPIRES_IN=24h

# AWS S3
AWS_ACCESS_KEY_ID=seu_access_key
AWS_SECRET_ACCESS_KEY=seu_secret_key
S3_BUCKET_NAME=seu-bucket-s3

# Redis (use apenas um dos formatos)
REDIS_URL=redis://localhost:6379
# ou
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Servidor
PORT=3000
NODE_ENV=development
```

Notas:
- A API usa cookie httpOnly "authToken" para autenticação. Em produção `secure: true` e `sameSite: none`.
- Para os uploads, a função gerarUrlPreAssinada usa `process.env.S3_BUCKET_NAME` e há fallback/bucket padrão ao subir arquivos. Configure corretamente seu bucket.


## Estrutura do Projeto
```
src/
├── app.js                 # Configuração do Express e middlewares
├── server.js              # Bootstrap do servidor HTTP
├── config/
│   ├── aws.js             # Cliente S3
│   ├── multerConfig.js    # Upload em memória
│   ├── redisClient.js     # Cliente Redis
│   └── Mongoose/
│       ├── funcionariosConnection.js
│       └── usuariosConnection.js
├── controllers/
│   ├── authController.js
│   ├── funcionariosController.js
│   ├── referencesController.js
│   ├── relatorioController.js
│   └── SetorController.js
├── models/
│   ├── funcionariosSchema.js
│   ├── setoresSchema.js
│   ├── usuariosSchema.js
│   ├── referenciasSchema.js
│   ├── limitesSimbologiaSchema.js
│   └── CargoComissionadoSchema.js
├── repositories/
│   ├── authRepository.js
│   ├── FuncionariosRepository.js
│   ├── SetorRepository.js
│   ├── cargoComissionadoRepository.js
│   ├── referencesRepository.js
│   └── searchRepository.js
├── routes/
│   ├── authRoutes.js
│   ├── funcionariosRoutes.js
│   ├── referencesRoutes.js
│   ├── searchRoutes.js
│   └── setoresRoutes.js
├── services/
│   ├── authService.js
│   ├── CacheService.js
│   ├── cargoComissionadoService.js
│   ├── funcionariosService.js
│   ├── referencesService.js
│   ├── RelatorioService.js
│   └── SetorService.js
├── utils/
│   ├── awsUtils.js
│   ├── LimiteService.js
│   ├── Logger.js
│   └── organizarSetores.js
└── validations/
    ├── validateFuncionario.js
    ├── validates.js
    └── validatesSetor.js
```


## Rotas da API
Base path: `/api`

### Autenticação — `/api/usuarios`
- POST `/login` — Login do usuário. Define cookie httpOnly `authToken`.
- POST `/logout` — Logout. Limpa token válido no servidor e cookie.
- GET `/verify` — Verifica o token do cookie. Retorna `{ authenticated, username, role }`.

Exemplo de login:
```bash
curl -X POST http://localhost:3000/api/usuarios/login \
  -H "Content-Type: application/json" \
  -d '{"id": "admin", "password": "senha123"}' -i
```

### Funcionários — `/api/funcionarios`
- GET `/buscarFuncionarios?page=1&limit=100` — Lista paginada (com cache e URLs pré-assinadas de S3).
- GET `/buscarFuncionariosPorCoordenadoria/:coordId` — Funcionários por coordenadoria.
- GET `/setores/:idSetor/funcionarios?page=1&limit=100` — Funcionários por setor (com paginação e cache).
- POST `/por-divisoes` — Lista por múltiplas divisões. Body: `{ ids: string[], page?, limit? }`.
- POST `/` — Cria funcionário. multipart/form-data com campos opcionais `foto` (imagem) e `arquivo` (PDF). Validação via Joi.
- PUT `/edit-funcionario/:id` — Atualiza funcionário (upload opcional `foto`/`arquivo`).
- DELETE `/delete-users` — Remove vários funcionários. Body: `{ userIds: string[] }`.
- PUT `/editar-coordenadoria-usuario` — Altera coordenadoria de usuários em lote. Body: `{ usuariosIds: string[], coordenadoriaId: string }`.
- PUT `/observacoes/:userId` — Atualiza observações (array de strings).
- POST `/relatorio-funcionarios/gerar` — Gera relatório PDF para funcionários (ver seção "Relatórios").
- GET `/buscarCargos` — Lista cargos comissionados (com cache).
- GET `/check-name?name=...` — Verifica disponibilidade de nome.
- GET `/:id/has-funcionarios` — Verifica se entidade (setor/coordenadoria) possui funcionários.

### Setores — `/api/setores`
- POST `/` — Cria setor. Body validado via Joi: `{ nome, tipo, parent? }`.
- GET `/setoresOrganizados` — Hierarquia completa organizada (com contagem).
- GET `/setoresMain` — Setores principais.
- GET `/dados/:setorId` — Subsetores/dados do setor.
- PUT `/rename/:id` — Renomeia setor.
- DELETE `/del/:id` — Remove setor e seus filhos.

### Busca — `/api/search`
- GET `/autocomplete?q=...` — Sugestões a partir de funcionários e setores (MongoDB Atlas Search autocomplete), retorna pares únicos `(nome, tipo)`.
- GET `/search-funcionarios?q=...` — Busca funcionários por texto e por hierarquia de setores. Retorna `{ funcionarios, setoresEncontrados }`.

### Referências — `/api/referencias`
- POST `/register-reference` — Cria referência. Body: `{ name, cargo?, telefone? }`.
- GET `/referencias-dados` — Lista referências (com cache por chave fixa).
- DELETE `/delete-referencia/:id` — Remove referência por id.

### Relatórios
Endpoint mapeado em rotas de funcionários:
- POST `/api/funcionarios/relatorio-funcionarios/gerar`
  - Body: `{ ids?: string[], tipo?: "salarial" | "referencias" | "localidade" | "geral" }`
  - Resposta: PDF (`Content-Type: application/pdf`, `Content-Disposition: attachment`)

Exemplo:
```bash
curl -X POST http://localhost:3000/api/funcionarios/relatorio-funcionarios/gerar \
  -H "Content-Type: application/json" \
  -d '{"tipo":"salarial"}' --output relatorio.pdf
```


## Cache
- Redis é utilizado para cachear:
  - Listagens de funcionários (paginadas, por setor/coordenadoria/divisões).
  - Hierarquia de setores e dados por setor.
  - Cargos comissionados.
  - Referências.
- As chaves seguem convenções como `setor:{id}:funcionarios:page:{n}`, `coordenadoria:{id}:funcionarios`, `todos:funcionarios:page{n}`, `setoresOrganizados`, etc.
- O serviço de cache possui rotinas para invalidar seletivamente conforme alterações (criação/edição/remoção).


## Uploads e Arquivos
- Upload via `multer` com armazenamento em memória (`multer.memoryStorage()`).
- Campos aceitos:
  - `foto`: imagem (jpeg, jpg, png, gif, webp) até 10MB.
  - `arquivo`: PDF até 10MB.
- Os arquivos são enviados para S3 via URL pré-assinada (PutObject) e o caminho é persistido no documento do funcionário.
- URLs pré-assinadas de leitura (GetObject) são geradas sob demanda para resposta de API.


## Testes
- Framework: Jest + Supertest.
- Testes de integração em `tests/integration` (rotas de funcionários e setores).
- Banco em memória: `mongodb-memory-server` para facilitar execução de testes.

Executar:
```bash
npm test
```

> Observação: os testes utilizam Redis; garanta um Redis local rodando ou ajuste a configuração conforme necessário.


## Qualidade de Código
- ESLint (eslint.config.mjs) e Prettier (.prettierrc).
- Scripts:
```bash
npm run lint   # Correção automática quando possível
```


## Segurança e CORS
- Helmet habilitado por padrão.
- Rate limit padrão: 100 requisições por minuto.
- CORS restrito a origens configuradas em `src/app.js`:
  - https://heroic-alfajores-da3394.netlify.app
  - https://interface-sistema-maranguape.vercel.app
  - http://localhost:5174
  - http://localhost:5173


## Licença
Este projeto está licenciado sob a licença MIT. Consulte o arquivo [LICENSE](./LICENSE).
