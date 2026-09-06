import { IsIn, IsOptional } from 'class-validator';
import type { OrderStatus } from '../../../domain/entities/sale-order.entity';

export class ListOrdersQueryDto {
  @IsOptional()
  @IsIn(['pendiente', 'procesado', 'rechazado'])
  status?: OrderStatus;
}
