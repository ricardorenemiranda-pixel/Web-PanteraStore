import { Inject, Injectable, Logger } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import type { Item, SetPiece } from '../../domain/entities/item.entity';
import { type ItemRepository, ITEM_REPOSITORY } from '../../domain/ports/item.repository.port';
import {
  type SteamMarketGateway,
  STEAM_MARKET_RAW_GATEWAY,
} from '../../domain/ports/steam-market.port';
import {
  STEAM_PRICE_CACHE_REPOSITORY,
  type SteamPriceCacheRepository,
} from '../../domain/ports/steam-price-cache.repository.port';

/**
 * Fuerza una consulta fresca a Steam Market para UN item puntual (botón de
 * admin) — a diferencia del camino normal (STEAM_MARKET_GATEWAY, que sirve
 * desde la tabla de caché), acá sí se le pega a Steam directo porque es una
 * acción explícita y puntual del admin, no algo que dispare un usuario
 * navegando. El resultado también se guarda en la caché compartida.
 */
@Injectable()
export class SyncItemPriceUseCase {
  private readonly logger = new Logger(SyncItemPriceUseCase.name);

  constructor(
    @Inject(ITEM_REPOSITORY) private readonly items: ItemRepository,
    @Inject(STEAM_MARKET_RAW_GATEWAY) private readonly steamMarket: SteamMarketGateway,
    @Inject(STEAM_PRICE_CACHE_REPOSITORY) private readonly priceCache: SteamPriceCacheRepository,
  ) {}

  async execute(itemId: string): Promise<void> {
    const item = await this.items.findById(itemId);
    if (!item) {
      throw new EntityNotFoundException('Item', itemId);
    }

    if (item.setPieces.length > 0) {
      await this.refreshSetPrice(item);
      return;
    }

    const latestPrice = await this.steamMarket.getLowestPrice(item.steamMarketHashName);
    await this.priceCache.set(item.steamMarketHashName, latestPrice);

    if (latestPrice === null) {
      this.logger.warn(`No se encontró precio en Steam Market para "${item.name}"`);
      return;
    }

    item.updateMarketPrice(latestPrice);
    await this.items.save(item);
  }

  /** Un set no tiene un solo precio en Steam: se vuelve a pedir el de cada pieza y se suman. */
  private async refreshSetPrice(item: Item): Promise<void> {
    const updatedPieces: SetPiece[] = [];
    for (const piece of item.setPieces) {
      const price = await this.steamMarket.getLowestPrice(piece.marketHashName);
      await this.priceCache.set(piece.marketHashName, price);
      updatedPieces.push({ ...piece, marketPrice: price ?? piece.marketPrice });
    }

    const totalPrice = updatedPieces.reduce((sum, p) => sum + p.marketPrice, 0);
    item.updateSetPieces(updatedPieces);
    item.updateMarketPrice(totalPrice);
    await this.items.save(item);
  }
}
