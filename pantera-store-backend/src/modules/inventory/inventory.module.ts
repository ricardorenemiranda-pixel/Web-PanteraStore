import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { INVENTORY_GATEWAY } from './domain/ports/inventory.port';
import { USER_INVENTORY_CACHE_REPOSITORY } from './domain/ports/user-inventory-cache.repository.port';
import { UserInventoryCacheOrmEntity } from './infrastructure/persistence/orm/user-inventory-cache.orm-entity';
import { TypeOrmUserInventoryCacheRepository } from './infrastructure/persistence/typeorm-user-inventory-cache.repository';
import { SteamInventoryHttpGateway } from './infrastructure/steam/steam-inventory-http.gateway';
import { InventoryController } from './interface/http/inventory.controller';
import { GetSellableInventoryUseCase } from './application/use-cases/get-sellable-inventory.use-case';

@Module({
  imports: [AuthModule, CatalogModule, TypeOrmModule.forFeature([UserInventoryCacheOrmEntity])],
  controllers: [InventoryController],
  providers: [
    GetSellableInventoryUseCase,
    { provide: INVENTORY_GATEWAY, useClass: SteamInventoryHttpGateway },
    { provide: USER_INVENTORY_CACHE_REPOSITORY, useClass: TypeOrmUserInventoryCacheRepository },
  ],
})
export class InventoryModule {}
