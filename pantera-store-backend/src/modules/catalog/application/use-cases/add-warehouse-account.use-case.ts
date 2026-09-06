import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WarehouseAccount } from '../../domain/entities/warehouse-account.entity';
import {
  WAREHOUSE_ACCOUNT_REPOSITORY,
  type WarehouseAccountRepository,
} from '../../domain/ports/warehouse-account.repository.port';

export interface AddWarehouseAccountInput {
  steamId: string;
  label: string;
}

@Injectable()
export class AddWarehouseAccountUseCase {
  constructor(
    @Inject(WAREHOUSE_ACCOUNT_REPOSITORY) private readonly accounts: WarehouseAccountRepository,
  ) {}

  async execute(input: AddWarehouseAccountInput): Promise<WarehouseAccount> {
    const account = WarehouseAccount.create({
      id: randomUUID(),
      steamId: input.steamId,
      label: input.label,
      addedAt: new Date(),
    });
    await this.accounts.save(account);
    return account;
  }
}
