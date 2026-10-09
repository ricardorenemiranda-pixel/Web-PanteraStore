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
  disputes: {
    /** Horas desde que termina una partida en las que un jugador puede impugnar su resultado. */
    windowHours: number;
  };
  terms: {
    /** Sube este número cuando cambien los Términos: a los usuarios que aceptaron una versión vieja se les vuelve a pedir. */
    version: number;
  };
  matches: {
    /** 'manual' (sin bot, el admin registra el ganador), 'fake' (simulado, solo desarrollo) o 'steam' (bot real, aún sin implementar). */
    provider: 'manual' | 'fake' | 'steam';
    /** Tiempo que tienen los jugadores para entrar al lobby antes de cancelar y reembolsar. */
    joinTimeoutSec: number;
    /** Cada cuánto el orquestador revisa el estado de las partidas activas. */
    pollIntervalSec: number;
  };
  payments: {
    /** Recargas y retiros reales. Apagado por defecto en producción: se activa a propósito con PAYMENTS_ENABLED=true. */
    enabled: boolean;
    limits: {
      deposit: { minCents: number; maxCents: number; dailyMaxCents: number; maxPending: number };
      withdrawal: { minCents: number; maxCents: number; dailyMaxCents: number; maxPending: number };
    };
    /** Dónde tienen que pagar los usuarios al recargar. */
    instructions: { yape: string; plin: string; bank: string; holder: string };
  };
  rooms: {
    /** Comisión de la plataforma sobre el total de entradas de cada sala (0-50). */
    platformFeePercent: number;
  };
  wallet: {
    /** Permite acreditar saldo de prueba desde el panel de admin. Nunca activo en producción por defecto. */
    testCreditsEnabled: boolean;
  };
  chat: {
    /** Mensajes por usuario permitidos dentro de la ventana (ver windowSec). */
    rateLimit: number;
    rateLimitWindowSec: number;
    maxLength: number;
  };
  community: {
    /** Enlace de invitación a Discord, si hay uno configurado. */
    discordInviteUrl: string;
  };
}

function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  steam: {
    apiKey: process.env.STEAM_API_KEY ?? '',
    returnUrl:
      process.env.STEAM_RETURN_URL ?? 'http://localhost:3001/auth/steam/return',
    realm: process.env.STEAM_REALM ?? 'http://localhost:3001/',
  },
  database: {
    url:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5433/pantera_store',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  whatsappNumber: process.env.WHATSAPP_NUMBER ?? '51900000000',
  adminSteamIds: (process.env.ADMIN_STEAM_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
  disputes: {
    windowHours: Math.max(Number(process.env.DISPUTE_WINDOW_HOURS ?? '48') || 48, 1),
  },
  terms: {
    version: Math.max(Number(process.env.TERMS_VERSION ?? '1') || 1, 1),
  },
  matches: {
    provider: (['manual', 'fake', 'steam'].includes(
      process.env.MATCH_PROVIDER ?? '',
    )
      ? process.env.MATCH_PROVIDER
      : 'manual') as 'manual' | 'fake' | 'steam',
    joinTimeoutSec: Math.max(
      Number(process.env.MATCH_JOIN_TIMEOUT_SEC ?? '300') || 300,
      30,
    ),
    pollIntervalSec: Math.max(
      Number(process.env.MATCH_POLL_INTERVAL_SEC ?? '5') || 5,
      1,
    ),
  },
  payments: {
    enabled:
      (process.env.PAYMENTS_ENABLED ??
        (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true',
    limits: {
      deposit: {
        minCents: intEnv('PAYMENTS_DEPOSIT_MIN_CENTS', 500),
        maxCents: intEnv('PAYMENTS_DEPOSIT_MAX_CENTS', 20000),
        dailyMaxCents: intEnv('PAYMENTS_DEPOSIT_DAILY_MAX_CENTS', 50000),
        maxPending: intEnv('PAYMENTS_DEPOSIT_MAX_PENDING', 3),
      },
      withdrawal: {
        minCents: intEnv('PAYMENTS_WITHDRAWAL_MIN_CENTS', 1000),
        maxCents: intEnv('PAYMENTS_WITHDRAWAL_MAX_CENTS', 20000),
        dailyMaxCents: intEnv('PAYMENTS_WITHDRAWAL_DAILY_MAX_CENTS', 50000),
        maxPending: intEnv('PAYMENTS_WITHDRAWAL_MAX_PENDING', 2),
      },
    },
    instructions: {
      yape: process.env.PAYMENTS_YAPE_NUMBER ?? '',
      plin: process.env.PAYMENTS_PLIN_NUMBER ?? '',
      bank: process.env.PAYMENTS_BANK_ACCOUNT ?? '',
      holder: process.env.PAYMENTS_ACCOUNT_HOLDER ?? '',
    },
  },
  rooms: {
    platformFeePercent: Math.min(
      Math.max(Number(process.env.ROOMS_PLATFORM_FEE_PERCENT ?? '10') || 0, 0),
      50,
    ),
  },
  wallet: {
    testCreditsEnabled:
      (process.env.WALLET_TEST_CREDITS_ENABLED ??
        (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true',
  },
  chat: {
    rateLimit: Math.max(Number(process.env.CHAT_RATE_LIMIT ?? '5') || 5, 1),
    rateLimitWindowSec: Math.max(Number(process.env.CHAT_RATE_LIMIT_WINDOW_SEC ?? '10') || 10, 1),
    maxLength: Math.max(Number(process.env.CHAT_MAX_LENGTH ?? '300') || 300, 1),
  },
  community: {
    discordInviteUrl: process.env.DISCORD_INVITE_URL ?? '',
  },
});
