import type { TransactionContext } from '../../../../shared/application/unit-of-work';
import type { Settlement } from '../entities/settlement.entity';

export const SETTLEMENT_REPOSITORY = Symbol('SETTLEMENT_REPOSITORY');

export interface SettlementRepository {
  findByMatchId(
    matchId: string,
    tx?: TransactionContext,
  ): Promise<Settlement | null>;
  findByMatchIds(matchIds: string[]): Promise<Settlement[]>;
  save(settlement: Settlement, tx?: TransactionContext): Promise<void>;
}
