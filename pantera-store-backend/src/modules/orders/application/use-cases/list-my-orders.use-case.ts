import { Inject, Injectable } from '@nestjs/common';
import { SaleOrder } from '../../domain/entities/sale-order.entity';
import {
  type SaleOrderRepository,
  SALE_ORDER_REPOSITORY,
} from '../../domain/ports/sale-order.repository.port';

/** Historial de órdenes del usuario logueado ("Mis compras"), no admin. */
@Injectable()
export class ListMyOrdersUseCase {
  constructor(@Inject(SALE_ORDER_REPOSITORY) private readonly orders: SaleOrderRepository) {}

  async execute(userSteamId: string): Promise<SaleOrder[]> {
    const orders = await this.orders.findByUserSteamId(userSteamId);
    return orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
