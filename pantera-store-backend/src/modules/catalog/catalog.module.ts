import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ITEM_REPOSITORY } from './domain/ports/item.repository.port';
import { PRICING_CONFIG_REPOSITORY } from './domain/ports/pricing-config.repository.port';
import {
  STEAM_MARKET_GATEWAY,
  STEAM_MARKET_RAW_GATEWAY,
} from './domain/ports/steam-market.port';
import { STEAM_PRICE_CACHE_REPOSITORY } from './domain/ports/steam-price-cache.repository.port';
import { ItemOrmEntity } from './infrastructure/persistence/orm/item.orm-entity';
import { PricingConfigOrmEntity } from './infrastructure/persistence/orm/pricing-config.orm-entity';
import { SteamPriceCacheOrmEntity } from './infrastructure/persistence/orm/steam-price-cache.orm-entity';
import { TypeOrmItemRepository } from './infrastructure/persistence/typeorm-item.repository';
import { TypeOrmPricingConfigRepository } from './infrastructure/persistence/typeorm-pricing-config.repository';
import { TypeOrmSteamPriceCacheRepository } from './infrastructure/persistence/typeorm-steam-price-cache.repository';
import { CachedSteamMarketGateway } from './infrastructure/steam/cached-steam-market.gateway';
import { SteamMarketHttpGateway } from './infrastructure/steam/steam-market-http.gateway';
import { PriceSyncScheduler } from './infrastructure/scheduler/price-sync.scheduler';
import { CatalogController } from './interface/http/catalog.controller';
import { CreateItemUseCase } from './application/use-cases/create-item.use-case';
import { DeleteItemUseCase } from './application/use-cases/delete-item.use-case';
import { GetItemUseCase } from './application/use-cases/get-item.use-case';
import { GetPricingConfigUseCase } from './application/use-cases/get-pricing-config.use-case';
import { ListItemsUseCase } from './application/use-cases/list-items.use-case';
import { PublishItemUseCase } from './application/use-cases/publish-item.use-case';
import { SyncAllPricesUseCase } from './application/use-cases/sync-all-prices.use-case';
import { SyncItemPriceUseCase } from './application/use-cases/sync-item-price.use-case';
import { UpdateGlobalMarkupUseCase } from './application/use-cases/update-global-markup.use-case';
import { UpdateItemUseCase } from './application/use-cases/update-item.use-case';
import { UpdateItemMarkupUseCase } from './application/use-cases/update-item-markup.use-case';
import { UpdateItemPriceUseCase } from './application/use-cases/update-item-price.use-case';
import { UpdateRarityMarkupUseCase } from './application/use-cases/update-rarity-markup.use-case';
import { UpdateSyncIntervalUseCase } from './application/use-cases/update-sync-interval.use-case';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ItemOrmEntity,
      PricingConfigOrmEntity,
      SteamPriceCacheOrmEntity,
    ]),
  ],
  controllers: [CatalogController],
  providers: [
    // Casos de uso (capa de aplicación)
    ListItemsUseCase,
    GetItemUseCase,
    CreateItemUseCase,
    UpdateItemUseCase,
    DeleteItemUseCase,
    UpdateItemMarkupUseCase,
    UpdateGlobalMarkupUseCase,
    UpdateItemPriceUseCase,
    PublishItemUseCase,
    SyncItemPriceUseCase,
    SyncAllPricesUseCase,
    GetPricingConfigUseCase,
    UpdateRarityMarkupUseCase,
    UpdateSyncIntervalUseCase,
    // Job programado — decide cuándo corresponde correr según el intervalo
    // configurado, sin que un usuario navegando dispare nada.
    PriceSyncScheduler,
    // Adaptadores concretos detrás de cada puerto (capa de infraestructura).
    // Para cambiar de adaptador: solo el `useClass` de acá, nada más.
    { provide: ITEM_REPOSITORY, useClass: TypeOrmItemRepository },
    {
      provide: PRICING_CONFIG_REPOSITORY,
      useClass: TypeOrmPricingConfigRepository,
    },
    {
      provide: STEAM_PRICE_CACHE_REPOSITORY,
      useClass: TypeOrmSteamPriceCacheRepository,
    },
    // El fetcher HTTP puro (sin caché por delante) — solo lo usan el job de
    // sync y el "sincronizar ahora" puntual de un item.
    { provide: STEAM_MARKET_RAW_GATEWAY, useClass: SteamMarketHttpGateway },
    // Lo que de verdad ve el resto de la app: sirve desde la tabla de
    // precios, nunca le pega a Steam en el camino de un usuario navegando.
    { provide: STEAM_MARKET_GATEWAY, useClass: CachedSteamMarketGateway },
  ],
  // Orders/Inventory necesitan leer items/precios vigentes desde acá.
  exports: [ITEM_REPOSITORY, PRICING_CONFIG_REPOSITORY, STEAM_MARKET_GATEWAY],
})
export class CatalogModule {}
