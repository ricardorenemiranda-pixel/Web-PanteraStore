import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PRICING_CONFIG_REPOSITORY,
  type PricingConfigRepository,
} from '../../domain/ports/pricing-config.repository.port';
import { SyncAllPricesUseCase } from '../../application/use-cases/sync-all-prices.use-case';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Revisa cada hora si ya pasó el intervalo que configuró el admin desde el
 * último sync completo — si no pasó, no hace nada (ni un solo request a
 * Steam). Esto es lo que hace que la web nunca dependa de Steam en el
 * camino de un usuario navegando.
 */
@Injectable()
export class PriceSyncScheduler {
  private readonly logger = new Logger(PriceSyncScheduler.name);

  constructor(
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
    private readonly syncAllPrices: SyncAllPricesUseCase,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkAndSyncIfDue(): Promise<void> {
    const intervalDays = await this.pricingConfig.getSyncIntervalDays();
    const lastSyncAt = await this.pricingConfig.getLastFullSyncAt();
    const dueAt = lastSyncAt ? lastSyncAt.getTime() + intervalDays * DAY_MS : 0;

    if (Date.now() < dueAt) {
      return;
    }

    this.logger.log(
      lastSyncAt
        ? `Han pasado ${intervalDays}+ días desde el último sync — sincronizando precios.`
        : 'Nunca se sincronizaron precios — sincronizando ahora.',
    );
    await this.syncAllPrices.execute();
  }
}
