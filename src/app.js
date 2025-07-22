const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('./scripts/validationToken')
const rateLimit = require('express-rate-limit');
const usuarioRoute = require('./routes/authRoutes');
const setoresRoutes = require('./routes/setoresRoutes');
const funcionariosRoutes = require('./routes/funcionariosRoutes');
const referenciasRoutes = require('./routes/referencesRoutes');
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
app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

app.set('trust proxy', 1);

// Configuração do rate limit
const limiter = rateLimit({
  windowMs: 60 * 1000, // 15 minutos
  max: 100, // Limita a 100 requisições por 15 minutos
});
app.use(limiter);

// Rotas (adicionaremos rotas mais tarde)
app.get('/', async (req, res) => {
  res.send('Hello World!');
});

app.use('/api/setores', setoresRoutes);
app.use('/api/funcionarios', funcionariosRoutes);
app.use('/api/usuarios', usuarioRoute);
app.use('/api/referencias', referenciasRoutes);
app.use('/api/search', searchRoutes);

module.exports = app;
