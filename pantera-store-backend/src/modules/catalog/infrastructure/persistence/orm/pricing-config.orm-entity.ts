import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Fila única (id fijo 'singleton') con la configuración de precios de la empresa. */
@Entity({ name: 'pricing_config' })
export class PricingConfigOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'float', default: 20 })
  globalMarkupPercent!: number;

  @Column({ type: 'float', default: 30 })
  buybackDiscountPercent!: number;

  @Column({ type: 'float', nullable: true })
  markupPercentMythical!: number | null;

  @Column({ type: 'float', nullable: true })
  markupPercentLegendary!: number | null;

  @Column({ type: 'float', nullable: true })
  markupPercentImmortal!: number | null;

  @Column({ type: 'float', nullable: true })
  markupPercentArcana!: number | null;

  @Column({ type: 'int', default: 7 })
  syncIntervalDays!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastFullSyncAt!: Date | null;
}
