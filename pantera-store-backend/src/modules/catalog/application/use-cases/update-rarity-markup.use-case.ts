import { Inject, Injectable } from '@nestjs/common';
import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import {
  PRICING_CONFIG_REPOSITORY,
  type PricingConfigRepository,
  type SellableRarity,
} from '../../domain/ports/pricing-config.repository.port';

const MIN_MARKUP_PERCENT = 0;
const MAX_MARKUP_PERCENT = 300;

@Injectable()
export class UpdateRarityMarkupUseCase {
  constructor(
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
  ) {}

  async execute(rarity: SellableRarity, percent: number | null): Promise<void> {
    if (percent !== null && (percent < MIN_MARKUP_PERCENT || percent > MAX_MARKUP_PERCENT)) {
      throw new InvalidDomainStateException(
        `El markup de ${rarity} debe estar entre ${MIN_MARKUP_PERCENT}% y ${MAX_MARKUP_PERCENT}%.`,
      );
    }
    await this.pricingConfig.setMarkupPercentByRarity(rarity, percent);
  }
}
