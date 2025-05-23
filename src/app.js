const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const Cookies = require('cookies');
const rateLimit = require('express-rate-limit');
const redis = require('./config/redisClient');
const usuarioRoute = require('./routes/usuariosRoute');
const setoresRoutes = require('./routes/setoresRoutes');
const funcionariosRoutes = require('./routes/funcionariosRoutes');
const referenciasRoutes = require('./routes/referenciasRoutes');
const searchRoutes = require('./routes/searchRoutes');

const app = express();

const allowedOrigins = [
  'https://heroic-alfajores-da3394.netlify.app',
  'https://interface-sistema-maranguape.vercel.app',
  'http://localhost:5174',
  'http://localhost:5173',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

// Middlewares globais
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.cookies = new Cookies(req, res); // Cria a instância de Cookies para cada requisição
  next(); // Passa para o próximo middleware ou rota
});
app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());

// Exemplo de teste de conexão
redis.on('connect', () => {
  console.log('Conectado ao Redis!');
});

redis.on('error', (err) => {
  console.error('Erro no Redis:', err);
});

app.set('trust proxy', 1);

// Configuração do rate limit
const limiter = rateLimit({
  windowMs: 60 * 1000, // 15 minutos
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
app.use('/api/search', searchRoutes);

module.exports = app;
