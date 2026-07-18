const AppError = require('../utils/AppError');
const logger = require('../utils/Logger');

function notFoundHandler(req, res, next) {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.isOperational ? err.message : 'Erro interno do servidor';

  if (!err.isOperational || statusCode >= 500) {
    logger.error(err.message || err, { stack: err.stack, path: req.originalUrl });
  }

  res.status(statusCode).json({
    error: true,
    code,
    message,
    ...(process.env.NODE_ENV !== 'production' && !err.isOperational
      ? { details: err.message }
      : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
