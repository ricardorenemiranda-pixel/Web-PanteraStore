import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseAccount } from '../../domain/entities/warehouse-account.entity';
import { WarehouseAccountRepository } from '../../domain/ports/warehouse-account.repository.port';
import { WarehouseAccountOrmEntity } from './orm/warehouse-account.orm-entity';

@Injectable()
export class TypeOrmWarehouseAccountRepository implements WarehouseAccountRepository {
  constructor(
    @InjectRepository(WarehouseAccountOrmEntity)
    private readonly repo: Repository<WarehouseAccountOrmEntity>,
  ) {}

  async findAll(): Promise<WarehouseAccount[]> {
    const rows = await this.repo.find();
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<WarehouseAccount | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async save(account: WarehouseAccount): Promise<void> {
    const row = new WarehouseAccountOrmEntity();
    row.id = account.id;
    row.steamId = account.steamId;
    row.label = account.label;
    row.addedAt = account.addedAt;
    await this.repo.save(row);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  private toDomain(row: WarehouseAccountOrmEntity): WarehouseAccount {
    return WarehouseAccount.create({
      id: row.id,
      steamId: row.steamId,
      label: row.label,
      addedAt: row.addedAt,
    });
  }
}
