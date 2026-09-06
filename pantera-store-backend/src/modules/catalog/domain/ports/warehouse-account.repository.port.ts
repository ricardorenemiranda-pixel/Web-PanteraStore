import { WarehouseAccount } from '../entities/warehouse-account.entity';

export const WAREHOUSE_ACCOUNT_REPOSITORY = Symbol('WAREHOUSE_ACCOUNT_REPOSITORY');

export interface WarehouseAccountRepository {
  findAll(): Promise<WarehouseAccount[]>;
  findById(id: string): Promise<WarehouseAccount | null>;
  save(account: WarehouseAccount): Promise<void>;
  delete(id: string): Promise<void>;
}
