import { ExternalServiceUnavailableException } from '../../../../shared/domain/exceptions/domain.exception';

export const STEAM_MARKET_GATEWAY = Symbol('STEAM_MARKET_GATEWAY');
/**
 * El fetcher HTTP puro (sin caché persistente por delante) — solo lo usa el
 * job de sincronización, que es quien decide cuándo sí toca pegarle a Steam.
 * Todo lo demás (catálogo, inventario) depende de STEAM_MARKET_GATEWAY.
 */
export const STEAM_MARKET_RAW_GATEWAY = Symbol('STEAM_MARKET_RAW_GATEWAY');

/**
 * Puerto hacia el mundo exterior (Steam Market). El dominio/aplicación solo
 * conocen esta interfaz; la implementación real (HTTP a Steam) vive en
 * infrastructure/steam y se puede reemplazar por un fake en los tests.
 */
export interface SteamMarketGateway {
  /** Precio actual de referencia en el Steam Market, en la moneda que use Steam para esa cuenta. */
  getLowestPrice(marketHashName: string): Promise<number | null>;
}

/** Steam respondió 429 aun después de reintentar: no es "sin precio", es "no se pudo consultar ahora". */
export class SteamRateLimitedException extends ExternalServiceUnavailableException {
  constructor() {
    super(
      'Steam Market está limitando las consultas. Espera unos minutos e intenta de nuevo.',
    );
  }
}
