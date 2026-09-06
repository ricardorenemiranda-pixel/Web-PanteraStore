import { Inject, Injectable } from '@nestjs/common';
import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import {
  type PricingConfigRepository,
  PRICING_CONFIG_REPOSITORY,
} from '../../domain/ports/pricing-config.repository.port';

const MIN_MARKUP_PERCENT = 0;
const MAX_MARKUP_PERCENT = 300;

@Injectable()
export class UpdateGlobalMarkupUseCase {
  constructor(
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
  ) {}

  async execute(percent: number): Promise<void> {
    if (percent < MIN_MARKUP_PERCENT || percent > MAX_MARKUP_PERCENT) {
      throw new InvalidDomainStateException(
        `El markup global debe estar entre ${MIN_MARKUP_PERCENT}% y ${MAX_MARKUP_PERCENT}%.`,
      );
    }
    await this.pricingConfig.setGlobalMarkupPercent(percent);
  }
}
