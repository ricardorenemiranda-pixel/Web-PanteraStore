import { Inject, Injectable } from '@nestjs/common';
import {
  PRICING_CONFIG_REPOSITORY,
  type PricingConfigRepository,
  type SellableRarity,
} from '../../domain/ports/pricing-config.repository.port';

export interface PricingConfigView {
  globalMarkupPercent: number;
  buybackDiscountPercent: number;
  rarityMarkups: Record<SellableRarity, number | null>;
  syncIntervalDays: number;
  lastFullSyncAt: Date | null;
}

/** Lo que ve el panel de administración al abrir la sección de Precios. */
@Injectable()
export class GetPricingConfigUseCase {
  constructor(
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
  ) {}

  async execute(): Promise<PricingConfigView> {
    const [globalMarkupPercent, buybackDiscountPercent, rarityMarkups, syncIntervalDays, lastFullSyncAt] =
      await Promise.all([
        this.pricingConfig.getGlobalMarkupPercent(),
        this.pricingConfig.getBuybackDiscountPercent(),
        this.pricingConfig.getAllRarityMarkups(),
        this.pricingConfig.getSyncIntervalDays(),
        this.pricingConfig.getLastFullSyncAt(),
      ]);

    return { globalMarkupPercent, buybackDiscountPercent, rarityMarkups, syncIntervalDays, lastFullSyncAt };
  }
}
