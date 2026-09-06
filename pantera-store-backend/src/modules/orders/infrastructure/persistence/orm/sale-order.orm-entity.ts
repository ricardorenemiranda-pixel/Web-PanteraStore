import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { OrderStatus, SaleOrderLineItem } from '../../../domain/entities/sale-order.entity';

@Entity({ name: 'sale_orders' })
export class SaleOrderOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar' })
  userSteamId!: string;

  @Column({ type: 'varchar' })
  userDisplayName!: string;

  @Column({ type: 'varchar' })
  tradeUrl!: string;

  @Column({ type: 'jsonb' })
  lineItems!: SaleOrderLineItem[];

  @Column({ type: 'varchar' })
  status!: OrderStatus;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
