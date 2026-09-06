import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PRICING_CONFIG_REPOSITORY,
  type PricingConfigRepository,
} from '../../domain/ports/pricing-config.repository.port';
import { SyncWarehouseCatalogUseCase } from '../../application/use-cases/sync-warehouse-catalog.use-case';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mismo patrón que PriceSyncScheduler, pero para el catálogo de almacén:
 * revisa cada hora si ya pasó el intervalo configurado desde el último sync
 * de almacén — si no pasó, no hace nada.
 */
@Injectable()
export class WarehouseSyncScheduler {
  private readonly logger = new Logger(WarehouseSyncScheduler.name);

  constructor(
    @Inject(PRICING_CONFIG_REPOSITORY) private readonly pricingConfig: PricingConfigRepository,
    private readonly syncWarehouseCatalog: SyncWarehouseCatalogUseCase,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkAndSyncIfDue(): Promise<void> {
    const intervalDays = await this.pricingConfig.getSyncIntervalDays();
    const lastSyncAt = await this.pricingConfig.getLastWarehouseSyncAt();
    const dueAt = lastSyncAt ? lastSyncAt.getTime() + intervalDays * DAY_MS : 0;

    if (Date.now() < dueAt) {
      return;
    }

    this.logger.log(
      lastSyncAt
        ? `Han pasado ${intervalDays}+ días desde el último sync de almacén — sincronizando catálogo.`
        : 'Nunca se sincronizó el catálogo de almacén — sincronizando ahora.',
    );
    await this.syncWarehouseCatalog.execute();
  }
}
