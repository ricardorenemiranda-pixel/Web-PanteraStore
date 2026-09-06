import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'warehouse_accounts' })
export class WarehouseAccountOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'varchar', unique: true })
  steamId!: string;

  @Column({ type: 'varchar' })
  label!: string;

  @Column({ type: 'timestamptz' })
  addedAt!: Date;
}
