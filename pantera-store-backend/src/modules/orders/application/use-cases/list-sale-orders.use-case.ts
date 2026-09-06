import { Inject, Injectable } from '@nestjs/common';
import type { OrderStatus, SaleOrder } from '../../domain/entities/sale-order.entity';
import {
  type SaleOrderRepository,
  SALE_ORDER_REPOSITORY,
} from '../../domain/ports/sale-order.repository.port';

@Injectable()
export class ListSaleOrdersUseCase {
  constructor(@Inject(SALE_ORDER_REPOSITORY) private readonly orders: SaleOrderRepository) {}

  async execute(status?: OrderStatus): Promise<SaleOrder[]> {
    return this.orders.findAll(status);
  }
}
