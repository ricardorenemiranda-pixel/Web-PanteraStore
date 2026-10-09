import { IsIn, IsString, Length } from 'class-validator';
import type {
  Match,
  MatchProviderKind,
  MatchStatus,
  MatchTeam,
  ResultSource,
} from '../../../domain/entities/match.entity';
import type { Settlement } from '../../../domain/entities/settlement.entity';
import type { HistoryEntry } from '../../../application/use-cases/settlement-use-cases';

export class SetMatchResultDto {
  @IsIn(['radiant', 'dire'])
  outcome!: MatchTeam;
}

export class VoidMatchDto {
  @IsString()
  @Length(3, 200)
  reason!: string;
}

interface TeamPlayerView {
  userId: string;
  displayName: string;
  /** Ya está dentro del lobby. */
  present: boolean;
}

/** Lo que este jugador ganó o perdió en la partida (solo cuando ya se pagó). */
interface MyResultView {
  won: boolean;
  entryCents: number;
  prizeCents: number;
  netCents: number;
}

/** Lo que ve un jugador de su partida. La clave del lobby SOLO se entrega mientras la partida está viva. */
export class MatchPlayerViewDto {
  id!: string;
  roomId!: string;
  status!: MatchStatus;
  provider!: MatchProviderKind;
  createdAt!: string;
  lobbyName!: string | null;
  lobbyPassword!: string | null;
  yourTeam!: MatchTeam | null;
  teams!: Record<MatchTeam, TeamPlayerView[]>;
  presentCount!: number;
  total!: number;
  joinDeadline!: string | null;
  outcome!: MatchTeam | null;
  resultSource!: ResultSource | null;
  /** true si nadie decidió aún el ganador y un admin tiene que hacerlo. */
  waitingForAdmin!: boolean;
  failureReason!: string | null;
  myResult!: MyResultView | null;

  static fromDomain(
    match: Match,
    yourTeam?: MatchTeam,
    settlement?: Settlement | null,
    userId?: string,
  ): MatchPlayerViewDto {
    const present = new Set(match.presentSteamIds);
    const teamOf = (team: MatchTeam): TeamPlayerView[] =>
      match.participants
        .filter((p) => p.team === team)
        .map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          present: present.has(p.steamId),
        }));
    const payout = userId ? settlement?.payoutOf(userId) : undefined;

    return {
      id: match.id,
      roomId: match.roomId,
      status: match.status,
      provider: match.provider,
      createdAt: match.createdAt.toISOString(),
      lobbyName: match.lobbyName ?? null,
      lobbyPassword: match.isActive ? (match.lobbyPassword ?? null) : null,
      yourTeam: yourTeam ?? null,
      teams: { radiant: teamOf('radiant'), dire: teamOf('dire') },
      presentCount: match.presentSteamIds.length,
      total: match.participants.length,
      joinDeadline: match.joinDeadline?.toISOString() ?? null,
      outcome: match.outcome ?? null,
      resultSource: match.resultSource ?? null,
      waitingForAdmin:
        match.status === 'in_game' &&
        (match.provider === 'manual' || match.needsReview),
      failureReason: match.failureReason ?? null,
      myResult: payout
        ? {
            won: payout.won,
            entryCents: payout.entryCents,
            prizeCents: payout.prizeCents,
            netCents: payout.prizeCents - payout.entryCents,
          }
        : null,
    };
  }
}

interface SettlementSummary {
  entryFeeCents: number;
  playerCount: number;
  prizePoolCents: number;
  prizeEachCents: number;
  platformCents: number;
}

/** Vista de administración: incluye SteamIDs, las marcas para revisar y cómo se repartió el dinero. */
export class MatchAdminViewDto {
  id!: string;
  roomId!: string;
  status!: MatchStatus;
  provider!: MatchProviderKind;
  needsReview!: boolean;
  outcome!: MatchTeam | null;
  resultSource!: ResultSource | null;
  dotaMatchId!: string | null;
  failureReason!: string | null;
  abandonedUserIds!: string[];
  createdAt!: string;
  finishedAt!: string | null;
  settlement!: SettlementSummary | null;
  participants!: {
    userId: string;
    steamId: string;
    displayName: string;
    team: MatchTeam;
  }[];

  static fromDomain(
    match: Match,
    settlement?: Settlement | null,
  ): MatchAdminViewDto {
    return {
      id: match.id,
      roomId: match.roomId,
      status: match.status,
      provider: match.provider,
      needsReview: match.needsReview,
      outcome: match.outcome ?? null,
      resultSource: match.resultSource ?? null,
      dotaMatchId: match.dotaMatchId ?? null,
      failureReason: match.failureReason ?? null,
      abandonedUserIds: match.abandonedUserIds,
      createdAt: match.createdAt.toISOString(),
      finishedAt: match.finishedAt?.toISOString() ?? null,
      settlement: settlement
        ? {
            entryFeeCents: settlement.entryFeeCents,
            playerCount: settlement.playerCount,
            prizePoolCents: settlement.prizePoolCents,
            prizeEachCents: settlement.prizeEachCents,
            platformCents: settlement.platformCents,
          }
        : null,
      participants: match.participants,
    };
  }
}

export class HistoryEntryDto {
  matchId!: string;
  roomId!: string;
  roomName!: string;
  mode!: string;
  at!: string;
  result!: 'won' | 'lost' | 'refunded';
  yourTeam!: MatchTeam;
  entryFeeCents!: number;
  prizeCents!: number;
  netCents!: number;
  dotaMatchId!: string | null;
  reason!: string | null;

  static fromEntry(entry: HistoryEntry): HistoryEntryDto {
    return {
      matchId: entry.matchId,
      roomId: entry.roomId,
      roomName: entry.roomName,
      mode: entry.mode,
      at: entry.at.toISOString(),
      result: entry.result,
      yourTeam: entry.yourTeam,
      entryFeeCents: entry.entryFeeCents,
      prizeCents: entry.prizeCents,
      netCents: entry.netCents,
      dotaMatchId: entry.dotaMatchId ?? null,
      reason: entry.reason ?? null,
    };
  }
}
