import { Inject, Injectable } from '@nestjs/common';
import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';
import {
  PRICING_CONFIG_REPOSITORY,
  type PricingConfigRepository,
} from '../../domain/ports/pricing-config.repository.port';

const MIN_DAYS = 1;
const MAX_DAYS = 90;

@Injectable()
export class UpdateSyncIntervalUseCase {
  constructor(
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
  ) {}

  async execute(days: number): Promise<void> {
    if (days < MIN_DAYS || days > MAX_DAYS) {
      throw new InvalidDomainStateException(
        `El intervalo de sincronización debe estar entre ${MIN_DAYS} y ${MAX_DAYS} días.`,
      );
    }
    await this.pricingConfig.setSyncIntervalDays(days);
  }
}
