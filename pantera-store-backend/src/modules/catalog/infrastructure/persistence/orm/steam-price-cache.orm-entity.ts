import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'steam_price_cache' })
export class SteamPriceCacheOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  marketHashName!: string;

  @Column({ type: 'float', nullable: true })
  price!: number | null;

  @Column({ type: 'timestamptz' })
  lastSyncedAt!: Date;
}
