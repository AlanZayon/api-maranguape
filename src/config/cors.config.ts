import { ConfigService } from '@nestjs/config';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const STATIC_ORIGINS = [
  'https://heroic-alfajores-da3394.netlify.app',
  'https://interface-sistema-maranguape.vercel.app',
  'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:4200',
];

export function buildCorsOptions(config: ConfigService): CorsOptions {
  const allowedOrigins = [
    ...STATIC_ORIGINS,
    ...(config.get<string>('CORS_ORIGINS')
      ? config.get<string>('CORS_ORIGINS')!.split(',')
      : []),
  ];

  const baseDomain = (config.get<string>('BASE_DOMAIN') || '')
    .toLowerCase()
    .replace(/^\./, '');

  function isAllowedOrigin(origin: string | undefined): boolean {
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
          `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.${baseDomain.replace(/\./g, '\\.')}$`,
        );
        if (subdomainPattern.test(hostname)) return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  };
}
