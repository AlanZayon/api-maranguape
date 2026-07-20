import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        const redis = url
          ? new Redis(`${url}?family=0`, { retryStrategy: () => null })
          : new Redis({
              host: config.get('REDIS_HOST') || '127.0.0.1',
              port: Number(config.get('REDIS_PORT')) || 6379,
              family: 4,
              retryStrategy: () => null,
            });

        redis.on('connect', () => console.log('Conectado ao Redis!'));
        redis.on('error', (err) =>
          console.error('Erro de conexão no Redis:', err),
        );
        return redis;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(private readonly config: ConfigService) {}

  // Nest will inject REDIS_CLIENT via module ref at destroy if needed;
  // ioredis quit is handled in tests/setup; keep process exit clean.
  async onModuleDestroy() {
    // no-op: connection shared; workers may still need it
  }
}

export { REDIS_CLIENT };
