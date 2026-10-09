import { Column, Entity, PrimaryColumn, ValueTransformer } from 'typeorm';
import type { ItemCategory, Rarity, SetPiece } from '../../../domain/entities/item.entity';

/** jsonb solo sabe guardar strings — convierte Date[] <-> ISO string[] al leer/escribir. */
const dateArrayTransformer: ValueTransformer = {
  to: (value: Date[] | undefined) => (value ?? []).map((d) => d.toISOString()),
  from: (value: string[] | null) => (value ?? []).map((s) => new Date(s)),
};

@Entity({ name: 'items' })
export class ItemOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  // nullable a nivel de columna para no romper `synchronize` sobre filas ya
  // existentes (creadas antes de este campo) — en la práctica todo item
  // siempre tiene uno, asignado por CreateItemUseCase al crearlo, y las
  // filas viejas se rellenaron con un script de backfill una sola vez.
  @Column({ type: 'varchar', nullable: true, unique: true })
  referenceCode!: string | null;

  @Column({ type: 'varchar', nullable: true })
  steamMarketHashName!: string | null;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  hero!: string | null;

  @Column({ type: 'varchar' })
  category!: ItemCategory;

  @Column({ type: 'varchar' })
  rarity!: Rarity;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'float' })
  marketPrice!: number;

  @Column({ type: 'float', nullable: true })
  markupPercentOverride!: number | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'timestamptz' })
  dateAdded!: Date;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  @Column({ type: 'jsonb', default: () => "'[]'", transformer: dateArrayTransformer })
  pendingHolds!: Date[];

  @Column({ type: 'float', nullable: true })
  manualPriceOverride!: number | null;

  // default: true — así los items que ya existían antes de este campo
  // (ya publicados/visibles) no desaparecen del catálogo público al agregar
  // la columna.
  @Column({ type: 'boolean', default: true })
  published!: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  setPieces!: SetPiece[];
}
