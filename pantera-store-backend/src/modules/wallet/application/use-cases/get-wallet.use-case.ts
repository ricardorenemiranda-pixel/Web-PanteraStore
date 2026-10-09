import { Inject, Injectable } from '@nestjs/common';
import type { LedgerEntry } from '../../domain/entities/ledger-entry.entity';
import type { Wallet } from '../../domain/entities/wallet.entity';
import {
  type ListEntriesOptions,
  type WalletRepository,
  WALLET_REPOSITORY,
} from '../../domain/ports/wallet.repository.port';

export interface WalletView {
  wallet: Wallet;
  entries: LedgerEntry[];
}

/** Saldos + historial de un usuario. Si todavía no tiene billetera, se le crea en cero. */
@Injectable()
export class GetWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository,
  ) {}

  async execute(
    userId: string,
    options?: ListEntriesOptions,
  ): Promise<WalletView> {
    const wallet = await this.wallets.getOrCreateForUser(userId);
    const entries = await this.wallets.listEntries(wallet.id, options);
    return { wallet, entries };
  }
}

/** La caja de la plataforma: lo que ganó en comisiones. Solo para el panel de admin. */
@Injectable()
export class GetPlatformWalletUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepository,
  ) {}

  async execute(options?: ListEntriesOptions): Promise<WalletView> {
    const wallet = await this.wallets.getOrCreateForUser(
      'platform',
      'platform',
    );
    return {
      wallet,
      entries: await this.wallets.listEntries(wallet.id, options),
    };
  }
}
