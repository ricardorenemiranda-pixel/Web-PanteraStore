import { Injectable, Logger } from '@nestjs/common';
import {
  SteamMarketGateway,
  SteamRateLimitedException,
} from '../../domain/ports/steam-market.port';

const DOTA2_APP_ID = 570;
// Código de moneda de Steam para Soles peruanos — verificado en vivo contra
// el endpoint real: currency=26 devuelve "S/.X.XX", currency=1 devuelve
// "$X.XX" (USD). Antes se pedía en USD y se guardaba tal cual como si fuera
// soles (el precio salía ~3.5x más bajo que el real).
const STEAM_CURRENCY_PEN = 26;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos — TODO: mover a Redis (ver README de inventory)
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface CacheEntry {
  price: number | null;
  expiresAt: number;
}

/**
 * Adaptador real: llama al endpoint público de Steam Market. No requiere
 * API key (es el mismo que usa la página web de Steam), pero Steam
 * rate-limitea agresivo por IP — devuelve 429 casi de inmediato si se pide
 * más de ~3-4 precios en paralelo (verificado en vivo: de 82 requests
 * simultáneos, la gran mayoría volvió 429). Por eso este gateway:
 *   1. Cachea cada precio en memoria un rato (mismo item se pide seguido
 *      desde catálogo/inventario de distintos usuarios).
 *   2. Reintenta una vez con espera si Steam responde 429; si sigue en 429
 *      lanza SteamRateLimitedException (no lo confunde con "sin precio").
 * El que llama a este gateway (ver GetSellableInventoryUseCase) además
 * limita cuántos requests dispara en paralelo — las dos cosas trabajan juntas.
 */
@Injectable()
export class SteamMarketHttpGateway implements SteamMarketGateway {
  private readonly logger = new Logger(SteamMarketHttpGateway.name);
  private readonly cache = new Map<string, CacheEntry>();

  async getLowestPrice(marketHashName: string): Promise<number | null> {
    const cached = this.cache.get(marketHashName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.price;
    }

    const price = await this.fetchPrice(marketHashName);
    this.cache.set(marketHashName, {
      price,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return price;
  }

  private async fetchPrice(
    marketHashName: string,
    isRetry = false,
  ): Promise<number | null> {
    const url = new URL('https://steamcommunity.com/market/priceoverview/');
    url.searchParams.set('appid', String(DOTA2_APP_ID));
    url.searchParams.set('currency', String(STEAM_CURRENCY_PEN));
    url.searchParams.set('market_hash_name', marketHashName);

    try {
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': USER_AGENT },
      });

      if (response.status === 429 && !isRetry) {
        await this.delay(2500);
        return this.fetchPrice(marketHashName, true);
      }

      if (response.status === 429) {
        this.logger.warn(`Steam Market respondió 429 para "${marketHashName}"`);
        throw new SteamRateLimitedException();
      }

      if (!response.ok) {
        this.logger.warn(
          `Steam Market respondió ${response.status} para "${marketHashName}"`,
        );
        return null;
      }

      const data = (await response.json()) as {
        success?: boolean;
        lowest_price?: string;
      };

      if (!data.success || !data.lowest_price) {
        return null;
      }

      return this.parsePrice(data.lowest_price);
    } catch (error) {
      if (error instanceof SteamRateLimitedException) throw error;
      this.logger.error(
        `Error consultando Steam Market para "${marketHashName}"`,
        error as Error,
      );
      return null;
    }
  }

  private parsePrice(raw: string): number | null {
    // El símbolo de soles "S/." trae un punto propio — hay que sacarlo antes
    // de filtrar, si no el punto del símbolo se cuela como si fuera parte
    // del número (ej. "S/.6.40" → sin esto quedaba ".6.40" → parseaba 0.6).
    const withoutCurrencySymbol = raw.replace(/^[^\d]+/, '');
    const numeric = withoutCurrencySymbol
      .replace(/[^0-9.,]/g, '')
      .replace(',', '.');
    const value = parseFloat(numeric);
    return Number.isFinite(value) ? value : null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
