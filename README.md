# Sistema de Gestão de Funcionários e Orgonogramas — API

Uma API REST usada para gerenciar funcionários, setores, autenticação (login), busca/autocomplete e geração de relatórios de escopo de Prefeituras Municipais.

Demonstração da interface web: https://interface-sistema-maranguape.vercel.app/


## TL;DR (para quem não é técnico)
- O que é: um "motor" de dados que guarda e organiza informações de funcionários e setores.
- Para que serve: consultar funcionários, organizar setores, fazer buscas e gerar relatórios em PDF.
- Como ver funcionando agora: acesse a interface web acima e navegue. A API é o que alimenta essa interface.
- Precisa instalar algo? Não para ver a interface. Para usar a API diretamente (sem a interface), siga a seção "Comece em 5 minutos".


## O que você consegue fazer
- Login seguro (usa cookie protegido) e verificação de sessão.
- Cadastrar, editar, listar e remover funcionários (com fotos/arquivos opcionais salvos em nuvem).
- Organizar setores (hierarquia: Setor, Subsetor, Coordenadoria) e ver contagens.
- Buscar por nome (autocomplete) e por termos (busca textual), tanto em funcionários quanto em setores.
- Gerar relatórios em PDF (por salário, por referências, por localidade e geral).
- Desempenho com cache (carrega dados mais rápido) e paginação nas listas.


## Como funciona (explicação simples)
- A API é como um balcão de atendimento: você faz um pedido (chamada HTTP) e recebe a resposta com os dados.
- A interface web é uma “página” que conversa com a API para exibir os dados de forma amigável.
- As fotos e arquivos dos funcionários vão para um armazenamento seguro na nuvem (S3). A API gera links temporários para visualizar.
- Para ficar rápido, usamos um "lembrete de respostas" (cache) que evita refazer contas repetidas.


# 📸 Demonstrações em GIF

Abaixo estão exemplos reais das principais funcionalidades do sistema,
gravados diretamente da interface. Cada GIF vem acompanhado de uma
descrição técnica.

------------------------------------------------------------------------

## 1️⃣ Login e Carregamento Inicial

![Login](./gifs/Login%20e%20Carregamento%20Inicial.gif)

**Descrição:**\
Demonstra o fluxo completo de autenticação. O usuário acessa a
interface, realiza login e a API valida as credenciais via cookie
httpOnly. Em seguida, a listagem inicial que é carregada
usando paginação e cache Redis, exibindo rapidez na resposta do backend.

------------------------------------------------------------------------

## 2️⃣ Busca com Autocomplete

![Autocomplete](./gifs/Busca%20com%20Autocomplete.gif)

**Descrição:**\
Mostra o sistema de autocomplete em ação. Conforme o usuário digita,
sugestões de funcionários e setores aparecem instantaneamente graças à
integração com o Atlas Search.

------------------------------------------------------------------------

## 3️⃣ Criação de Funcionário com Upload para S3

![CreateFuncionario](./gifs/Criação%20de%20Funcionário%20com%20Upload%20para%20S3.gif)

**Descrição:**\
Apresenta o processo de cadastro de um novo funcionário. O usuário
preenche o formulário, envia uma foto e confirma o cadastro. O arquivo é
processado pelo Multer, enviado ao Amazon S3 e, logo após a criação, o
novo funcionário aparece na lista com seu respectivo link pré-assinado.

------------------------------------------------------------------------

## 4️⃣ Edição e Atualização de Funcionário

![UpdateFuncionario](./gifs/Edição%20e%20Atualização%20de%20Funcionário.gif)

**Descrição:**\
Demonstra a edição de um funcionário já existente. Após abrir o perfil,
o usuário altera campos como cargo, setor ou contato e salva as
alterações. As modificações são imediatamente refletidas na listagem,
mostrando o funcionamento das rotas PUT e o CRUD completo da API.

------------------------------------------------------------------------

## 5️⃣ Organização de Setores em Hierarquia

![HierarquiaSetores](./gifs/Organização%20de%20Setores%20em%20Hierarquia.gif)

**Descrição:**\
Mostra a navegação pela estrutura hierárquica dos setores (Setor →
Subsetor → Coordenadoria). Cada nível exibe suas informações e a
contagem de funcionários vinculados. Esse GIF evidencia o tratamento de
relações hierárquicas complexas e agregações realizadas pelo MongoDB.

------------------------------------------------------------------------

## 6️⃣ Geração de Relatório em PDF

![RelatorioPDF](./gifs/Geração%20de%20Relatório%20em%20PDF.gif)

**Descrição:**\
Exibe o processo de criação de relatórios. O usuário seleciona o tipo
desejado (ex.: salarial), solicita a geração e recebe o download
automático do PDF. Ao abrir o arquivo, o relatório aparece totalmente
formatado, comprovando o uso do PDFKit e o envio correto de respostas
binárias pela API.

------------------------------------------------------------------------

## 7️⃣ Busca Textual Completa

![BuscaCompleta](./gifs/Busca%20Textual%20Completa.gif)

**Descrição:**\
O usuário executa uma busca textual completa digitando um termo inteiro.
Os resultados são exibidos agrupados por setor ou coordenadoria, e a
rolagem revela diferentes níveis hierárquicos. Essa demonstração destaca
o uso de agregações, indexação e filtros avançados na rota `/search`.

------------------------------------------------------------------------

## 8️⃣ Ações em Massa

![AcoesMassa](./gifs/Ações%20em%20Massa.gif)

**Descrição:**\
Apresenta operações em lote. O usuário seleciona múltiplos funcionários
e executa uma ação --- como excluir usuários ou alterar a coordenadoria
de todos de uma vez. O resultado é aplicado imediatamente, mostrando
operações bulk via rotas POST/PUT e validações adequadas no backend.


## Comece em 5 minutos
Escolha UMA das opções abaixo.

1) Sem instalar nada — usar a interface web
- Acesse: https://interface-sistema-maranguape.vercel.app/
- Navegue e teste as telas (a interface usa esta API por trás).

2) Docker (recomendado para testar tudo rápido)
- Pré-requisitos: Docker e Docker Compose.
- Comando:
```
docker-compose up --build
```
- Acesse pelo navegador: http://localhost:8080 (Nginx faz proxy para a API)

3) Instalação local (para desenvolvedores)
```
# Clonar
git clone https://github.com/AlanZayon/api-maranguape.git
cd api-maranguape

# Instalar dependências
npm install

# Criar arquivo .env (veja a próxima seção)

# Rodar em desenvolvimento
npm run dev
# ou produção
npm run prod
```
- API: http://localhost:3000


## Variáveis de Ambiente (.env)
Exemplo de .env (coloque na raiz do projeto):

```
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

Notas importantes:
- A API usa cookie httpOnly "authToken" para autenticação. Em produção: secure=true e sameSite=none.
- Uploads usam o bucket definido em S3_BUCKET_NAME; configure permissões adequadas.


## Guia rápido da API (sem ser técnico)
- Fazer login: peça ao responsável técnico um usuário e senha. O sistema guarda um cookie seguro, você não precisa lidar com token manualmente.
- Buscar funcionários: use a interface web para digitar o nome e ver resultados.
- Baixar relatórios: na interface, escolha o tipo de relatório e clique em gerar.


## Exemplos rápidos (para quem quer testar a API)
- Login:
```
curl -X POST http://localhost:3000/api/usuarios/login \
  -H "Content-Type: application/json" \
  -d '{"id": "admin", "password": "senha123"}' -i
```

- Gerar relatório (PDF):
```
curl -X POST http://localhost:3000/api/funcionarios/relatorio-funcionarios/gerar \
  -H "Content-Type: application/json" \
  -d '{"tipo":"salarial"}' --output relatorio.pdf
```


## Para desenvolvedores

### Tecnologias
- Node.js, Express
- MongoDB/Mongoose (conexões separadas para funcionários e usuários)
- Redis (ioredis)
- JWT para autenticação
- Joi para validações
- Multer (upload em memória)
- AWS SDK v3 (S3)
- PDFKit para relatórios
- Helmet, CORS, rate limiting, morgan
- Jest e Supertest para testes

### Arquitetura (camadas)
- routes: definição das rotas e mapeamento para controllers.
- controllers: lidam com HTTP e delegam a services.
- services: regras de negócio, composição de repositórios e utilitários.
- repositories: acesso a dados (Mongoose) e integrações de baixo nível.
- models: schemas do Mongoose.
- middlewares: validações e proteção (ex.: Joi).
- utils: utilitários transversais (AWS S3, logger, etc.).
- config: conexões (MongoDB, Redis), multer, AWS S3.

### Requisitos
- Node.js 18+ (Docker usa Node 20)
- MongoDB 4.4+
- Redis 6+
- AWS S3 (para armazenamento de arquivos)

### Estrutura do Projeto
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
|   └── SetorService.js
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

### Rotas principais (resumo)
Base path: `/api`

- Autenticação — `/api/usuarios`
  - POST `/login` — cria cookie httpOnly `authToken`.
  - POST `/logout` — invalida token e limpa cookie.
  - GET `/verify` — retorna `{ authenticated, username, role }`.

- Funcionários — `/api/funcionarios`
  - GET `/buscarFuncionarios?page=1&limit=100` — lista (com cache e URLs S3 pré-assinadas).
  - GET `/buscarFuncionariosPorCoordenadoria/:coordId`
  - GET `/setores/:idSetor/funcionarios?page=1&limit=100`
  - POST `/por-divisoes` — `{ ids: string[], page?, limit? }`
  - POST `/` — cria funcionário (multipart: `foto` imagem, `arquivo` PDF)
  - PUT `/edit-funcionario/:id`
  - DELETE `/delete-users` — `{ userIds: string[] }`
  - PUT `/editar-coordenadoria-usuario` — `{ usuariosIds: string[], coordenadoriaId: string }`
  - PUT `/observacoes/:userId` — atualiza observações (array de strings)
  - POST `/relatorio-funcionarios/gerar` — retorna PDF
  - GET `/buscarCargos` — cargos comissionados (cache)
  - GET `/check-name?name=...`
  - GET `/:id/has-funcionarios`

- Setores — `/api/setores`
  - POST `/` — cria setor `{ nome, tipo, parent? }`
  - GET `/setoresOrganizados`
  - GET `/setoresMain`
  - GET `/dados/:setorId`
  - PUT `/rename/:id`
  - DELETE `/del/:id`

- Busca — `/api/search`
  - GET `/autocomplete?q=...` — sugestões (funcionários e setores) via Atlas Search
  - GET `/search-funcionarios?q=...` — busca textual + por hierarquia

- Referências — `/api/referencias`
  - POST `/register-reference` — `{ name, cargo?, telefone? }`
  - GET `/referencias-dados` — cache por chave fixa
  - DELETE `/delete-referencia/:id`

- Relatórios
  - POST `/api/funcionarios/relatorio-funcionarios/gerar`
    - Body: `{ ids?: string[], tipo?: "salarial" | "referencias" | "localidade" | "geral" }`
    - Resposta: PDF (`Content-Type: application/pdf`)

### Cache
- Redis para cachear listas, hierarquias, cargos e referências.
- Chaves padronizadas, ex.: `setor:{id}:funcionarios:page:{n}`, `coordenadoria:{id}:funcionarios`, `todos:funcionarios:page{n}`, `setoresOrganizados`.

### Uploads e Arquivos
- `multer.memoryStorage()` com validação de tipos e limite 10MB.
- Campos: `foto` (jpeg, jpg, png, gif, webp), `arquivo` (PDF).
- Envio para S3 via URL pré-assinada; leitura também via URL pré-assinada.

### Testes
- Jest + Supertest.
- Integração em `tests/integration` e unitários em `tests/unit`.
- Banco em memória com `mongodb-memory-server`.
```
npm test
```

### Qualidade e Segurança
- ESLint e Prettier. Script: `npm run lint`
- Helmet, CORS restrito, rate limit (100 req/min), morgan.
- Origens permitidas (CORS) em `src/app.js`:
  - https://heroic-alfajores-da3394.netlify.app
  - https://interface-sistema-maranguape.vercel.app
  - http://localhost:5174
  - http://localhost:5173


## Glossário (ajuda para quem não é técnico)
- API: é como um balcão onde programas pedem e recebem informações.
- Endpoint/rota: a “porta” da API para um tipo de pedido (ex.: /login).
- Cookie httpOnly: um arquivo seguro que guarda sua sessão de login.
- Cache: um atalho para responder mais rápido sem refazer tudo.
- S3: serviço na nuvem para guardar arquivos com segurança.


## Solução de problemas (FAQ rápido)
- Não consigo logar: confirme usuário/senha e se o navegador permite cookies.
- Relatório não baixa: verifique se o pop-up/download está liberado e se o tipo solicitado existe.
- Imagem/arquivo não aparece: pode ser link temporário expirado; recarregue a página ou faça nova consulta.
- Erro de CORS ao chamar API: confira se sua origem está na lista permitida em `src/app.js`.

## Minhas responsabilidades neste projeto

- Arquitetura completa do backend (Node.js + Express)
- Integração com MongoDB e Redis
- Implementação da autenticação segura via cookies httpOnly
- Sistema de uploads com AWS S3 e links pré-assinados
- Construção dos serviços e controllers (funcionários, setores, busca, relatórios…)
- Implementação dos relatórios em PDF (PDFKit)
- Sistema de cache configurável por chave (Redis)
- Documentação completa
- Deploy da interface e infraestrutura Docker

## Skills Demonstradas

- Arquitetura Node.js escalável
- API REST profissional
- Programação assíncrona e otimização
- Estruturação completa com services/controllers
- CI/CD e Docker
- Segurança web: cookies httpOnly, CORS, Helmet, rate limit
- MongoDB avançado (agregações, conexões separadas)
- Redis para otimização de desempenho
- Geração de PDFs profissionais
- Boas práticas de documentação

⚡ Este projeto demonstra minha capacidade de construir um sistema backend completo, seguro,
performático e pronto para produção, incluindo autenticação, cache, uploads, relatórios e 
arquitetura profissional. É um exemplo perfeito do tipo de solução que posso entregar em ambiente real.

## Licença
Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](./LICENSE).