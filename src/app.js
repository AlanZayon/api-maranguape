const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('./scripts/validationToken');
const rateLimit = require('express-rate-limit');
const { registerRoutes } = require('./modules/registerRoutes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { resolveTenant } = require('./middlewares/tenant');
const metrics = require('./middlewares/metrics');

const app = express();

const allowedOrigins = [
  'https://heroic-alfajores-da3394.netlify.app',
  'https://interface-sistema-maranguape.vercel.app',
  'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:4200',
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
];

const baseDomain = (process.env.BASE_DOMAIN || '').toLowerCase().replace(/^\./, '');

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;

    if (hostname.endsWith('.localhost') || hostname === 'localhost') {
      return true;
    }

    if (baseDomain) {
      if (hostname === baseDomain || hostname === `www.${baseDomain}`) {
        return true;
      }
      const subdomainPattern = new RegExp(
        `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.${baseDomain.replace(/\./g, '\\.')}$`
      );
      if (subdomainPattern.test(hostname)) return true;
    }
  } catch {
    return false;
  }

  return false;
}

const corsOptions = {
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(metrics);
app.set('etag', false);
app.set('trust proxy', 1);

app.use(resolveTenant);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get('/', async (req, res) => {
  res.json({ status: 'ok', service: 'api-organograma' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.get('/metrics', (req, res) => {
  res.json(metrics.getSnapshot());
});

registerRoutes(app);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
