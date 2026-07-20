export type EnvConfig = {
  NODE_ENV?: string;
  PORT?: string;
  MONGO_CONNECTING_FUNCIONARIOS: string;
  MONGO_CONNECTING_USUARIOS?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN?: string;
  REDIS_URL?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  S3_BUCKET_NAME?: string;
  BASE_DOMAIN?: string;
  CORS_ORIGINS?: string;
  RATE_LIMIT_MAX?: string;
  BULK_WORKER_EMBEDDED?: string;
  TENANT_CUSTOM_CSS_ENABLED?: string;
  TENANT_CUSTOM_CSS_MAX_LENGTH?: string;
  TENANT_BRANDING_EDITABLE_FIELDS?: string;
  TENANT_CUSTOM_CSS_ALLOWED_SELECTORS?: string;
  TENANT_FONT_URL_HOSTS?: string;
  TENANT_BRANDING_ASSET_MAX_BYTES?: string;
};

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const required = ['MONGO_CONNECTING_FUNCIONARIOS', 'JWT_SECRET'];
  for (const key of required) {
    if (!config[key] || String(config[key]).trim() === '') {
      throw new Error(`Missing required env: ${key}`);
    }
  }
  return config as EnvConfig;
}
