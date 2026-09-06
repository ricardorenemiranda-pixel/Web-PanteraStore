import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { SALE_ORDER_REPOSITORY } from './domain/ports/sale-order.repository.port';
import { SaleOrderOrmEntity } from './infrastructure/persistence/orm/sale-order.orm-entity';
import { TypeOrmSaleOrderRepository } from './infrastructure/persistence/typeorm-sale-order.repository';
import { OrdersController } from './interface/http/orders.controller';
import { CreateSaleOrderUseCase } from './application/use-cases/create-sale-order.use-case';
import { ListMyOrdersUseCase } from './application/use-cases/list-my-orders.use-case';
import { ListSaleOrdersUseCase } from './application/use-cases/list-sale-orders.use-case';
import { ReviewSaleOrderUseCase } from './application/use-cases/review-sale-order.use-case';

@Module({
  imports: [AuthModule, CatalogModule, TypeOrmModule.forFeature([SaleOrderOrmEntity])],
  controllers: [OrdersController],
  providers: [
    CreateSaleOrderUseCase,
    ReviewSaleOrderUseCase,
    ListSaleOrdersUseCase,
    ListMyOrdersUseCase,
    { provide: SALE_ORDER_REPOSITORY, useClass: TypeOrmSaleOrderRepository },
  ],
})
export class OrdersModule {}
