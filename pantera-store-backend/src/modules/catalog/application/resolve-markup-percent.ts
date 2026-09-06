import { Rarity } from '../domain/entities/item.entity';
import { SellableRarity } from '../domain/ports/pricing-config.repository.port';

/**
 * Orden de prioridad del markup aplicado a un item: override propio del item
 * (ya resuelto dentro de Item.sellPrice/buybackPrice) → markup de su rareza
 * → markup global. Esta función resuelve solo la segunda parte (rareza →
 * global); el override por item lo sigue resolviendo la entidad misma.
 */
export function resolveMarkupPercent(
  rarity: Rarity,
  rarityMarkups: Record<SellableRarity, number | null>,
  globalMarkupPercent: number,
): number {
  const rarityMarkup = (rarityMarkups as Partial<Record<Rarity, number | null>>)[rarity];
  return rarityMarkup ?? globalMarkupPercent;
}
