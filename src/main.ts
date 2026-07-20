import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { buildCorsOptions } from './config/cors.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MetricsMiddleware } from './common/middleware/metrics.middleware';
import { mountLegacyRouters } from './legacy-bridge';

async function bootstrap() {
  process.env.NEST_HOST = 'true';

  // All domains served by Nest controllers
  if (!process.env.NEST_MIGRATED) {
    process.env.NEST_MIGRATED = 'all';
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });

  const config = app.get(ConfigService);
  const metrics = app.get(MetricsMiddleware);

  app.enableCors(buildCorsOptions(config));
  app.use(helmet());
  app.use(morgan('dev'));
  app.use(cookieParser());
  app.use(compression());
  app.use(
    (
      req: import('express').Request,
      res: import('express').Response,
      next: import('express').NextFunction,
    ) => metrics.use(req, res, next),
  );
  app.set('etag', false);
  app.set('trust proxy', 1);

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: Number(config.get('RATE_LIMIT_MAX')) || 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();

  const migrated = process.env.NEST_MIGRATED || 'all';
  if (migrated !== 'all') {
    mountLegacyRouters(app.getHttpAdapter().getInstance(), migrated);
  }

  const port = Number(config.get('PORT')) || 3000;
  await app.listen(port);
  console.log(`Servidor Nest rodando na porta ${port}`);
  console.log(`NEST_MIGRATED=${process.env.NEST_MIGRATED}`);
}

bootstrap().catch((err) => {
  console.error('Falha ao iniciar a aplicação:', err);
  process.exit(1);
});
