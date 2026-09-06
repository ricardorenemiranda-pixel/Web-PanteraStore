import { OrderStatus, SaleOrder } from '../entities/sale-order.entity';

export const SALE_ORDER_REPOSITORY = Symbol('SALE_ORDER_REPOSITORY');

export interface SaleOrderRepository {
  findAll(status?: OrderStatus): Promise<SaleOrder[]>;
  findByUserSteamId(userSteamId: string): Promise<SaleOrder[]>;
  findById(id: string): Promise<SaleOrder | null>;
  save(order: SaleOrder): Promise<void>;
}
