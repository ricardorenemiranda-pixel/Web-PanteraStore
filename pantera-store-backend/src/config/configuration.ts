export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  corsOrigin: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  steam: {
    apiKey: string;
    returnUrl: string;
    realm: string;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  whatsappNumber: string;
  /** SteamID64 de las cuentas que deben loguearse con rol "admin" en vez de "customer". */
  adminSteamIds: string[];
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  steam: {
    apiKey: process.env.STEAM_API_KEY ?? '',
    returnUrl: process.env.STEAM_RETURN_URL ?? 'http://localhost:3001/auth/steam/return',
    realm: process.env.STEAM_REALM ?? 'http://localhost:3001/',
  },
  database: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/pantera_store',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  whatsappNumber: process.env.WHATSAPP_NUMBER ?? '51900000000',
  adminSteamIds: (process.env.ADMIN_STEAM_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
});
