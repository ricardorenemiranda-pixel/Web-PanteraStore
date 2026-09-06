import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import type { SaleOrder } from '../../domain/entities/sale-order.entity';
import {
  type SaleOrderRepository,
  SALE_ORDER_REPOSITORY,
} from '../../domain/ports/sale-order.repository.port';

/** Casos de uso del panel de administración para cerrar una orden pendiente. */
@Injectable()
export class ReviewSaleOrderUseCase {
  constructor(@Inject(SALE_ORDER_REPOSITORY) private readonly orders: SaleOrderRepository) {}

  async approve(orderId: string): Promise<SaleOrder> {
    const order = await this.findOrThrow(orderId);
    order.approve();
    await this.orders.save(order);
    return order;
  }

  async reject(orderId: string): Promise<SaleOrder> {
    const order = await this.findOrThrow(orderId);
    order.reject();
    await this.orders.save(order);
    return order;
  }

  private async findOrThrow(orderId: string): Promise<SaleOrder> {
    const order = await this.orders.findById(orderId);
    if (!order) {
      throw new EntityNotFoundException('SaleOrder', orderId);
    }
    return order;
  }
}
