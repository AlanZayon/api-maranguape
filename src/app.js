const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const bcrypt = require('bcryptjs')
const Cookies = require('cookies'); // Importar a biblioteca cookies
const rateLimit = require('express-rate-limit');
const dbUsuarios = require('./config/Mongoose/usuariosConnection');
const dbFuncionarios = require('./config/Mongoose/funcionariosConnection');
const redis = require('./config/redisClient'); // Importa o cliente Redis
const usuarioRoute = require("./routes/usuariosRoute")
const setoresRoutes = require('./routes/setoresRoutes');
const funcionariosRoutes = require('./routes/funcionariosRoutes');
const referenciasRoutes = require('./routes/referenciasRoutes');


const app = express();

// Middlewares globais
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.cookies = new Cookies(req, res); // Cria a instância de Cookies para cada requisição
  next(); // Passa para o próximo middleware ou rota
});
app.use(cors({
  origin: "http://localhost:5173",  // URL do seu frontend
  credentials: true, // Permite o envio de cookies
}));
app.use(helmet());
app.use(compression());

// Exemplo de teste de conexão
redis.on('connect', () => {
  console.log('Conectado ao Redis!');
});

redis.on('error', (err) => {
  console.error('Erro no Redis:', err);
});

// app.use("api/usuarios", usuarioRoute);

// Configuração do rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limita a 100 requisições por 15 minutos
});
app.use(limiter);

// Rotas (adicionaremos rotas mais tarde)
app.get('/', async (req, res) => {

  const senha = 'Pref@2024';
  const saltRounds = 10;
  const hash = await bcrypt.hash(senha, saltRounds);
  console.log('Hash da senha:', hash);

    res.send('Hello World!, Pref@2024');
});

app.use('/api/setores', setoresRoutes);
app.use('/api/funcionarios', funcionariosRoutes);
app.use('/api/usuarios', usuarioRoute);
app.use('/api/referencias', referenciasRoutes);




module.exports = app;
