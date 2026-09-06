import { Inject, Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../../shared/domain/exceptions/domain.exception';
import {
  WAREHOUSE_ACCOUNT_REPOSITORY,
  type WarehouseAccountRepository,
} from '../../domain/ports/warehouse-account.repository.port';

@Injectable()
export class RemoveWarehouseAccountUseCase {
  constructor(
    @Inject(WAREHOUSE_ACCOUNT_REPOSITORY) private readonly accounts: WarehouseAccountRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const account = await this.accounts.findById(id);
    if (!account) {
      throw new EntityNotFoundException('WarehouseAccount', id);
    }
    await this.accounts.delete(id);
  }
}
