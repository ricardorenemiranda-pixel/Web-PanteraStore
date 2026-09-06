import { Rarity } from '../../../catalog/domain/entities/item.entity';

export class SellableInventoryItem {
  assetId: string;
  marketHashName: string;
  name: string;
  hero: string | null;
  rarity: Rarity;
  imageUrl: string;
  /** null si Steam Market no tiene precio de referencia para este item ahora mismo */
  buybackPrice: number | null;
}
