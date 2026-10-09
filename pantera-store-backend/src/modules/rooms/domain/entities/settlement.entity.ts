import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

export interface SettlementInput {
  entryFeeCents: number;
  playerCount: number;
  /** Bolsa a repartir entre los ganadores (ya descontada la comisión fija de la sala). */
  prizePoolCents: number;
  winnerCount: number;
}

export interface SettlementAmounts {
  /** Lo que recibe cada ganador. */
  prizeEachCents: number;
  /** Todo lo que se queda la plataforma: la comisión más el sobrante de dividir la bolsa. */
  platformCents: number;
}

/**
 * Reparte la bolsa entre los ganadores. Los céntimos que no se pueden dividir
 * en partes iguales NO desaparecen: se los queda la plataforma. Así, siempre:
 *   entradas cobradas = premios pagados + lo que recibe la plataforma.
 */
export function computeSettlement(input: SettlementInput): SettlementAmounts {
  const { entryFeeCents, playerCount, prizePoolCents, winnerCount } = input;
  if (winnerCount < 1 || winnerCount >= playerCount) {
    throw new InvalidDomainStateException(
      'Debe haber al menos un ganador y un perdedor.',
    );
  }
  const totalCents = entryFeeCents * playerCount;
  if (prizePoolCents < 0 || prizePoolCents > totalCents) {
    throw new InvalidDomainStateException('La bolsa de premios no es válida.');
  }
  const prizeEachCents = Math.floor(prizePoolCents / winnerCount);
  return {
    prizeEachCents,
    platformCents: totalCents - prizeEachCents * winnerCount,
  };
}

export interface SettlementPayout {
  userId: string;
  displayName: string;
  team: 'radiant' | 'dire';
  won: boolean;
  /** Lo que pagó de entrada. */
  entryCents: number;
  /** Lo que ganó (0 si perdió). */
  prizeCents: number;
}

export interface SettlementProps {
  id: string;
  matchId: string;
  roomId: string;
  entryFeeCents: number;
  playerCount: number;
  prizePoolCents: number;
  prizeEachCents: number;
  platformCents: number;
  payouts: SettlementPayout[];
  createdAt: Date;
  /** Si una disputa la revirtió: quién y cuándo. Los payouts NUNCA se editan; esto solo marca que ya no rige. */
  reversedBy?: string;
  reversedAt?: Date;
}

/** Registro inmutable de cómo se repartió el dinero de una sala terminada. */
export class Settlement {
  private constructor(private readonly props: Readonly<SettlementProps>) {}

  static restore(props: SettlementProps): Settlement {
    return new Settlement({ ...props, payouts: [...props.payouts] });
  }

  static create(input: Omit<SettlementProps, 'createdAt'>): Settlement {
    const paid = input.payouts.reduce((sum, p) => sum + p.prizeCents, 0);
    const collected = input.payouts.reduce((sum, p) => sum + p.entryCents, 0);
    if (collected !== paid + input.platformCents) {
      throw new InvalidDomainStateException(
        'La liquidación no cuadra: entradas ≠ premios + comisión.',
      );
    }
    return new Settlement({ ...input, createdAt: new Date() });
  }

  get id(): string {
    return this.props.id;
  }
  get matchId(): string {
    return this.props.matchId;
  }
  get roomId(): string {
    return this.props.roomId;
  }
  get entryFeeCents(): number {
    return this.props.entryFeeCents;
  }
  get playerCount(): number {
    return this.props.playerCount;
  }
  get prizePoolCents(): number {
    return this.props.prizePoolCents;
  }
  get prizeEachCents(): number {
    return this.props.prizeEachCents;
  }
  get platformCents(): number {
    return this.props.platformCents;
  }
  get payouts(): SettlementPayout[] {
    return [...this.props.payouts];
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get reversedBy(): string | undefined {
    return this.props.reversedBy;
  }
  get reversedAt(): Date | undefined {
    return this.props.reversedAt;
  }
  get isReversed(): boolean {
    return this.props.reversedAt !== undefined;
  }

  payoutOf(userId: string): SettlementPayout | undefined {
    return this.props.payouts.find((p) => p.userId === userId);
  }
}

/** Foto de la liquidación ya con la reversión aplicada (no muta el objeto original: crea uno nuevo). */
export function markSettlementReversed(settlement: Settlement, adminId: string): Settlement {
  return Settlement.restore({
    id: settlement.id,
    matchId: settlement.matchId,
    roomId: settlement.roomId,
    entryFeeCents: settlement.entryFeeCents,
    playerCount: settlement.playerCount,
    prizePoolCents: settlement.prizePoolCents,
    prizeEachCents: settlement.prizeEachCents,
    platformCents: settlement.platformCents,
    payouts: settlement.payouts,
    createdAt: settlement.createdAt,
    reversedBy: adminId,
    reversedAt: new Date(),
  });
}
