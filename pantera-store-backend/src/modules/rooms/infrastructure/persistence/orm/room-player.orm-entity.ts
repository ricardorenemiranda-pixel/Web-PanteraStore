import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Solo hay filas de jugadores que están DENTRO de la sala; al salir o cancelarse se borran (el historial de plata queda en el libro de la billetera). */
@Entity({ name: 'room_players' })
@Index(['userId'])
export class RoomPlayerOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  roomId!: string;

  @PrimaryColumn({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  displayName!: string;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar' })
  joinId!: string;

  @Column({ type: 'timestamptz' })
  joinedAt!: Date;
}
