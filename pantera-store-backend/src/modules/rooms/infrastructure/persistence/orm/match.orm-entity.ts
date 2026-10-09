import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type {
  MatchParticipant,
  MatchProviderKind,
  MatchStatus,
  MatchTeam,
  ResultSource,
} from '../../../domain/entities/match.entity';

@Entity({ name: 'matches' })
@Index(['status'])
export class MatchOrmEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  // Una sala puede tener varias partidas a lo largo del tiempo (si un jugador sale y la sala se vuelve a llenar); solo una activa a la vez.
  @Index()
  @Column({ type: 'varchar' })
  roomId!: string;

  @Column({ type: 'varchar' })
  status!: MatchStatus;

  @Column({ type: 'varchar' })
  provider!: MatchProviderKind;

  @Column({ type: 'jsonb' })
  participants!: MatchParticipant[];

  @Column({ type: 'varchar', nullable: true })
  lobbyRef!: string | null;

  @Column({ type: 'varchar', nullable: true })
  lobbyName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  lobbyPassword!: string | null;

  @Column({ type: 'jsonb' })
  presentSteamIds!: string[];

  @Column({ type: 'timestamptz', nullable: true })
  joinDeadline!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  dotaMatchId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  outcome!: MatchTeam | null;

  @Column({ type: 'varchar', nullable: true })
  resultSource!: ResultSource | null;

  @Column({ type: 'jsonb' })
  abandonedUserIds!: string[];

  @Column({ type: 'boolean', default: false })
  needsReview!: boolean;

  @Column({ type: 'varchar', nullable: true })
  failureReason!: string | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
