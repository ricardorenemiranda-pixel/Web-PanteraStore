import { Rarity } from '../entities/item.entity';

export const PRICING_CONFIG_REPOSITORY = Symbol('PRICING_CONFIG_REPOSITORY');

/** Rarezas que la empresa compra/vende y para las que tiene sentido un markup propio. */
export type SellableRarity = 'mythical' | 'legendary' | 'immortal' | 'arcana';

/**
 * Configuración global de precios que la empresa controla desde el panel de
 * administración: markup por defecto para todo item sin override propio (o
 * sin markup de su rareza), el descuento que se aplica al recomprarle un
 * item al usuario, el markup específico por rareza, y cada cuánto se
 * sincronizan los precios contra Steam Market.
 */
export interface PricingConfigRepository {
  getGlobalMarkupPercent(): Promise<number>;
  setGlobalMarkupPercent(percent: number): Promise<void>;
  getBuybackDiscountPercent(): Promise<number>;
  setBuybackDiscountPercent(percent: number): Promise<void>;
  /** null = esa rareza no tiene override propio, se usa el markup global. */
  getMarkupPercentByRarity(rarity: SellableRarity): Promise<number | null>;
  setMarkupPercentByRarity(rarity: SellableRarity, percent: number | null): Promise<void>;
  getAllRarityMarkups(): Promise<Record<SellableRarity, number | null>>;
  /** Cada cuántos días se re-sincronizan todos los precios contra Steam Market. */
  getSyncIntervalDays(): Promise<number>;
  setSyncIntervalDays(days: number): Promise<void>;
  getLastFullSyncAt(): Promise<Date | null>;
  setLastFullSyncAt(date: Date): Promise<void>;
}
