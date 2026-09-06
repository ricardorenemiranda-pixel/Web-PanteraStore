import { OrderStatus, SaleOrder, SaleOrderLineItem } from '../../../domain/entities/sale-order.entity';

export class SaleOrderResponseDto {
  id: string;
  userDisplayName: string;
  tradeUrl: string;
  lineItems: SaleOrderLineItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;

  static fromDomain(order: SaleOrder): SaleOrderResponseDto {
    const dto = new SaleOrderResponseDto();
    dto.id = order.id;
    dto.userDisplayName = order.userDisplayName;
    dto.tradeUrl = order.tradeUrl;
    dto.lineItems = order.lineItems;
    dto.total = order.total;
    dto.status = order.status;
    dto.createdAt = order.createdAt.toISOString();
    return dto;
  }
}
