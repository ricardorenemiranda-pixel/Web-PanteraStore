import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { InventoryItem } from '../../../domain/ports/inventory.port';

@Entity({ name: 'user_inventory_cache' })
export class UserInventoryCacheOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  steamId!: string;

  @Column({ type: 'jsonb' })
  items!: InventoryItem[];

  @Column({ type: 'timestamptz' })
  scannedAt!: Date;
}
