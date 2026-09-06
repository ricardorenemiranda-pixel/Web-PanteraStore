import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SteamInventoryHttpGateway } from '../inventory/infrastructure/steam/steam-inventory-http.gateway';
import { ITEM_REPOSITORY } from './domain/ports/item.repository.port';
import { PRICING_CONFIG_REPOSITORY } from './domain/ports/pricing-config.repository.port';
import { STEAM_MARKET_GATEWAY, STEAM_MARKET_RAW_GATEWAY } from './domain/ports/steam-market.port';
import { STEAM_PRICE_CACHE_REPOSITORY } from './domain/ports/steam-price-cache.repository.port';
import { WAREHOUSE_ACCOUNT_REPOSITORY } from './domain/ports/warehouse-account.repository.port';
import { WAREHOUSE_INVENTORY_GATEWAY } from './domain/ports/warehouse-inventory.port';
import { ItemOrmEntity } from './infrastructure/persistence/orm/item.orm-entity';
import { PricingConfigOrmEntity } from './infrastructure/persistence/orm/pricing-config.orm-entity';
import { SteamPriceCacheOrmEntity } from './infrastructure/persistence/orm/steam-price-cache.orm-entity';
import { WarehouseAccountOrmEntity } from './infrastructure/persistence/orm/warehouse-account.orm-entity';
import { TypeOrmItemRepository } from './infrastructure/persistence/typeorm-item.repository';
import { TypeOrmPricingConfigRepository } from './infrastructure/persistence/typeorm-pricing-config.repository';
import { TypeOrmSteamPriceCacheRepository } from './infrastructure/persistence/typeorm-steam-price-cache.repository';
import { TypeOrmWarehouseAccountRepository } from './infrastructure/persistence/typeorm-warehouse-account.repository';
import { CachedSteamMarketGateway } from './infrastructure/steam/cached-steam-market.gateway';
import { SteamMarketHttpGateway } from './infrastructure/steam/steam-market-http.gateway';
import { PriceSyncScheduler } from './infrastructure/scheduler/price-sync.scheduler';
import { WarehouseSyncScheduler } from './infrastructure/scheduler/warehouse-sync.scheduler';
import { CatalogController } from './interface/http/catalog.controller';
import { WarehouseController } from './interface/http/warehouse.controller';
import { AddWarehouseAccountUseCase } from './application/use-cases/add-warehouse-account.use-case';
import { GetItemUseCase } from './application/use-cases/get-item.use-case';
import { GetPricingConfigUseCase } from './application/use-cases/get-pricing-config.use-case';
import { ListItemsUseCase } from './application/use-cases/list-items.use-case';
import { ListWarehouseAccountsUseCase } from './application/use-cases/list-warehouse-accounts.use-case';
import { PublishItemUseCase } from './application/use-cases/publish-item.use-case';
import { RemoveWarehouseAccountUseCase } from './application/use-cases/remove-warehouse-account.use-case';
import { SyncAllPricesUseCase } from './application/use-cases/sync-all-prices.use-case';
import { SyncItemPriceUseCase } from './application/use-cases/sync-item-price.use-case';
import { SyncWarehouseCatalogUseCase } from './application/use-cases/sync-warehouse-catalog.use-case';
import { UpdateGlobalMarkupUseCase } from './application/use-cases/update-global-markup.use-case';
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
      WarehouseAccountOrmEntity,
    ]),
  ],
  controllers: [CatalogController, WarehouseController],
  providers: [
    // Casos de uso (capa de aplicación)
    ListItemsUseCase,
    GetItemUseCase,
    UpdateItemMarkupUseCase,
    UpdateGlobalMarkupUseCase,
    UpdateItemPriceUseCase,
    PublishItemUseCase,
    SyncItemPriceUseCase,
    SyncAllPricesUseCase,
    GetPricingConfigUseCase,
    UpdateRarityMarkupUseCase,
    UpdateSyncIntervalUseCase,
    AddWarehouseAccountUseCase,
    RemoveWarehouseAccountUseCase,
    ListWarehouseAccountsUseCase,
    SyncWarehouseCatalogUseCase,
    // Jobs programados — deciden cuándo corresponde correr según el
    // intervalo configurado, sin que un usuario navegando dispare nada.
    PriceSyncScheduler,
    WarehouseSyncScheduler,
    // Adaptadores concretos detrás de cada puerto (capa de infraestructura).
    // Para cambiar de adaptador: solo el `useClass` de acá, nada más.
    { provide: ITEM_REPOSITORY, useClass: TypeOrmItemRepository },
    { provide: PRICING_CONFIG_REPOSITORY, useClass: TypeOrmPricingConfigRepository },
    { provide: STEAM_PRICE_CACHE_REPOSITORY, useClass: TypeOrmSteamPriceCacheRepository },
    { provide: WAREHOUSE_ACCOUNT_REPOSITORY, useClass: TypeOrmWarehouseAccountRepository },
    // El fetcher HTTP puro (sin caché por delante) — solo lo usan el job de
    // sync y el "sincronizar ahora" puntual de un item.
    { provide: STEAM_MARKET_RAW_GATEWAY, useClass: SteamMarketHttpGateway },
    // Lo que de verdad ve el resto de la app: sirve desde la tabla de
    // precios, nunca le pega a Steam en el camino de un usuario navegando.
    { provide: STEAM_MARKET_GATEWAY, useClass: CachedSteamMarketGateway },
    // Mismo gateway que usa `inventory` para leer el inventario de un
    // usuario, pero registrado acá aparte (sin importar InventoryModule,
    // que ya depende de CatalogModule) para leer el de las cuentas de almacén.
    { provide: WAREHOUSE_INVENTORY_GATEWAY, useClass: SteamInventoryHttpGateway },
  ],
  // Orders/Inventory necesitan leer items/precios vigentes desde acá.
  exports: [ITEM_REPOSITORY, PRICING_CONFIG_REPOSITORY, STEAM_MARKET_GATEWAY],
})
export class CatalogModule {}
