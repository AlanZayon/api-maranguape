
# Sistema de Gestão de Funcionários - API

Esta API fornece endpoints para gerenciamento completo de funcionários, setores, autenticação e geração de relatórios para a Prefeitura Municipal.

site para experimentar: https://interface-sistema-maranguape.vercel.app/

acesse o login usando ID:0006  senha:Pref@2024

## 📋 Requisitos

- Node.js 16+
- MongoDB 4.4+
- Redis (para cache)
- AWS S3 (para armazenamento de arquivos)

## 🚀 Instalação

```bash
# Clone o repositório
git clone https://github.com/AlanZayon/api-maranguape.git

# Instale as dependências
npm install

# Configure as variáveis de ambiente (crie um arquivo .env)
cp .env.example .env

# Inicie o servidor
npm start
```

## 🔧 Variáveis de Ambiente

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

# Redis
REDIS_URL=redis://localhost:6379

# Servidor
PORT=3000
NODE_ENV=development
```

## 📚 Documentação da API

### Autenticação

| Método | Endpoint      | Descrição             |
|--------|---------------|------------------------|
| POST   | /auth/login   | Login de usuário       |
| POST   | /auth/logout  | Logout                 |
| GET    | /auth/verify  | Verifica autenticação  |

### Funcionários

| Método | Endpoint                              | Descrição                      |
|--------|----------------------------------------|--------------------------------|
| GET    | /funcionarios/buscarFuncionarios       | Lista paginada de funcionários |
| POST   | /funcionarios                          | Cadastra novo funcionário      |
| PUT    | /funcionarios/edit-funcionario/:id     | Atualiza funcionário           |
| DELETE | /funcionarios/delete-users             | Remove múltiplos funcionários  |

### Setores

| Método | Endpoint                  | Descrição                       |
|--------|---------------------------|----------------------------------|
| GET    | /setores/setoresOrganizados | Lista hierárquica de setores     |
| POST   | /setores                    | Cria novo setor                  |
| DELETE | /setores/del/:id           | Remove setor e sub-setores       |

### Relatórios

| Método | Endpoint             | Descrição            |
|--------|----------------------|-----------------------|
| POST   | /relatorios/gerar    | Gera relatório em PDF |

## 🛠️ Estrutura do Projeto

```
src/
├── config/
│   ├── aws.js            # Configuração AWS S3
│   ├── multerConfig.js   # Upload de arquivos
│   └── redisClient.js    # Conexão Redis
├── controllers/
│   ├── authController.js
│   ├── funcionariosController.js
│   └── relatorioController.js
├── middlewares/
│   └── validate.js       # Validação Joi
├── models/
│   ├── funcionariosSchema.js
│   └── usuariosSchema.js
├── repositories/
│   ├── FuncionariosRepository.js
│   └── SetorRepository.js
├── routes/
│   ├── authRoutes.js
│   ├── funcionariosRoutes.js
│   └── setoresRoutes.js
├── services/
│   ├── FuncionarioService.js
│   └── RelatorioService.js
├── app.js                # Config Express
└── server.js             # Inicialização
```

## 💡 Exemplos de Uso

### Login

```bash
curl -X POST http://localhost:3000/auth/login   -H "Content-Type: application/json"   -d '{"id": "admin", "password": "senha123"}'
```

### Criar Funcionário

```bash
curl -X POST http://localhost:3000/funcionarios   -H "Authorization: Bearer <token>"   -H "Content-Type: application/json"   -d '{
    "nome": "João Silva",
    "secretaria": "Saúde",
    "funcao": "Enfermeiro",
    "natureza": "EFETIVO",
    "salarioBruto": 4500.00
  }'
```

### Gerar Relatório

```bash
curl -X POST http://localhost:3000/relatorios/gerar   -H "Authorization: Bearer <token>"   -H "Content-Type: application/json"   -d '{"tipo": "salarial"}'   --output relatorio.pdf
```

## 📄 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.
