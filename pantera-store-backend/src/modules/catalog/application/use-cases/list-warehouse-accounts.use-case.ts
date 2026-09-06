import { Inject, Injectable } from '@nestjs/common';
import { WarehouseAccount } from '../../domain/entities/warehouse-account.entity';
import {
  WAREHOUSE_ACCOUNT_REPOSITORY,
  type WarehouseAccountRepository,
} from '../../domain/ports/warehouse-account.repository.port';

@Injectable()
export class ListWarehouseAccountsUseCase {
  constructor(
    @Inject(WAREHOUSE_ACCOUNT_REPOSITORY) private readonly accounts: WarehouseAccountRepository,
  ) {}

  async execute(): Promise<WarehouseAccount[]> {
    return this.accounts.findAll();
  }
}
