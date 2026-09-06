import { Injectable, Logger } from '@nestjs/common';
import { ExternalServiceUnavailableException } from '../../../../shared/domain/exceptions/domain.exception';
import { Rarity } from '../../../catalog/domain/entities/item.entity';
import { InventoryGateway, InventoryItem } from '../../domain/ports/inventory.port';

const DOTA2_APP_ID = 570;
const DOTA2_CONTEXT_ID = 2;
const ECONOMY_IMAGE_BASE = 'https://community.steamstatic.com/economy/image/';
// Steam responde 400 Bad Request si count pasa de un límite (verificado: 2000
// funciona, 5000 no) — se pagina con start_assetid en vez de pedir todo junto.
const PAGE_SIZE = 2000;
const MAX_PAGES = 10;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const RARITY_BY_STEAM_TAG: Record<string, Rarity> = {
  Common: 'common',
  Uncommon: 'uncommon',
  Rare: 'rare',
  Mythical: 'mythical',
  Legendary: 'legendary',
  Immortal: 'immortal',
  Arcana: 'arcana',
  Ancient: 'ancient',
};

interface SteamAssetTag {
  category: string;
  localized_tag_name: string;
}

interface SteamAsset {
  classid: string;
  instanceid: string;
  assetid: string;
}

/** Bloque de texto libre que Steam manda por descripción (ej. "Tradable After ..."). */
interface SteamDescriptionTextBlock {
  type?: string;
  value: string;
}

interface SteamDescription {
  classid: string;
  instanceid: string;
  market_hash_name: string;
  name: string;
  icon_url: string;
  tradable: number;
  marketable: number;
  tags?: SteamAssetTag[];
  /** Bloques de texto (ej. el aviso de trade hold en regalos recién recibidos). */
  descriptions?: SteamDescriptionTextBlock[];
}

// Texto real de Steam para un item en trade hold: algo como
// "Tradable After Mar 5, 2026 (13:00:00 GMT)" — se corta antes del
// paréntesis porque Date() no parsea bien esa parte.
const TRADABLE_AFTER_PATTERN = /Tradable After ([^(]+)/i;

interface SteamInventoryResponse {
  success?: number;
  assets?: SteamAsset[];
  descriptions?: SteamDescription[];
  more_items?: number;
  last_assetid?: string;
}

/**
 * Lee el inventario público de Dota 2 de un SteamID vía el endpoint público
 * de Steam Community — no requiere ninguna cuenta de bot ni sesión logueada,
 * solo que el perfil del usuario tenga el inventario visible como público
 * (la configuración por defecto de Steam).
 *
 * Nota: Steam rate-limitea este endpoint agresivo por IP si se golpea muy
 * seguido — ver TODO de caché en Redis en el README de este módulo.
 */
@Injectable()
export class SteamInventoryHttpGateway implements InventoryGateway {
  private readonly logger = new Logger(SteamInventoryHttpGateway.name);

  async getDota2Inventory(steamId: string): Promise<InventoryItem[]> {
    const assets: SteamAsset[] = [];
    const descriptions: SteamDescription[] = [];
    let startAssetId: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await this.fetchPage(steamId, startAssetId);
      if (!data) {
        break;
      }

      assets.push(...(data.assets ?? []));
      descriptions.push(...(data.descriptions ?? []));

      if (data.more_items && data.last_assetid) {
        startAssetId = data.last_assetid;
      } else {
        break;
      }
    }

    const descriptionByKey = new Map<string, SteamDescription>();
    for (const description of descriptions) {
      descriptionByKey.set(`${description.classid}_${description.instanceid}`, description);
    }

    return assets
      .map((asset) => ({ asset, description: descriptionByKey.get(`${asset.classid}_${asset.instanceid}`) }))
      .filter((entry): entry is { asset: SteamAsset; description: SteamDescription } =>
        Boolean(entry.description),
      )
      .map(({ asset, description }) => this.toInventoryItem(asset, description));
  }

  private async fetchPage(
    steamId: string,
    startAssetId?: string,
    retriesLeft = 3,
  ): Promise<SteamInventoryResponse | null> {
    const url = new URL(
      `https://steamcommunity.com/inventory/${steamId}/${DOTA2_APP_ID}/${DOTA2_CONTEXT_ID}`,
    );
    url.searchParams.set('l', 'english');
    url.searchParams.set('count', String(PAGE_SIZE));
    if (startAssetId) {
      url.searchParams.set('start_assetid', startAssetId);
    }

    const response = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT } });

    if (response.status === 429) {
      if (retriesLeft <= 0) {
        throw new ExternalServiceUnavailableException(
          'Steam está limitando las peticiones de inventario ahora mismo. Intenta de nuevo en unos segundos.',
        );
      }
      this.logger.warn(`Steam devolvió 429 leyendo inventario, reintentando (${retriesLeft} left)...`);
      await this.delay(2500);
      return this.fetchPage(steamId, startAssetId, retriesLeft - 1);
    }

    if (!response.ok) {
      if (response.status === 403) {
        // Perfil/inventario privado, o Steam bloqueó la IP momentáneamente.
        this.logger.warn(`Inventario no accesible para steamId ${steamId} (HTTP 403).`);
        return null;
      }
      throw new Error(`Steam respondió ${response.status} al pedir el inventario.`);
    }

    const data = (await response.json()) as SteamInventoryResponse;
    if (!data.success) {
      return null;
    }

    return data;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private toInventoryItem(asset: SteamAsset, description: SteamDescription): InventoryItem {
    const tags = description.tags ?? [];
    const rarityTag = tags.find((t) => t.category === 'Rarity');
    const heroTag = tags.find((t) => t.category === 'Hero');
    const typeTag = tags.find((t) => t.category === 'Type');
    const slotTag = tags.find((t) => t.category === 'Slot');
    const tradable = description.tradable === 1;

    return {
      assetId: asset.assetid,
      marketHashName: description.market_hash_name,
      name: description.name,
      hero: heroTag && heroTag.localized_tag_name !== 'Other' ? heroTag.localized_tag_name : null,
      rarity: rarityTag ? (RARITY_BY_STEAM_TAG[rarityTag.localized_tag_name] ?? null) : null,
      imageUrl: `${ECONOMY_IMAGE_BASE}${description.icon_url}`,
      tradable,
      marketable: description.marketable === 1,
      tradeHoldUntil: tradable ? null : this.parseTradeHoldDate(description.descriptions),
      typeTag: typeTag ? typeTag.localized_tag_name : null,
      slotTag: slotTag ? slotTag.localized_tag_name : null,
    };
  }

  /**
   * Regalos recién recibidos quedan en trade hold ~7 días. Steam lo indica
   * como texto libre ("Tradable After ...") dentro de `descriptions`, no
   * como un campo estructurado — si el formato no calza con el patrón
   * esperado (o Steam lo cambia), simplemente no se encuentra fecha y el
   * item queda como "en hold, sin fecha conocida" (ver README del módulo).
   */
  private parseTradeHoldDate(textBlocks?: SteamDescriptionTextBlock[]): Date | null {
    for (const block of textBlocks ?? []) {
      const match = block.value?.match(TRADABLE_AFTER_PATTERN);
      if (!match) continue;
      const parsed = new Date(match[1].trim());
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return null;
  }
}
