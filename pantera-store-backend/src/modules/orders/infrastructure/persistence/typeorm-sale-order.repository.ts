import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatus, SaleOrder } from '../../domain/entities/sale-order.entity';
import { SaleOrderRepository } from '../../domain/ports/sale-order.repository.port';
import { SaleOrderOrmEntity } from './orm/sale-order.orm-entity';

@Injectable()
export class TypeOrmSaleOrderRepository implements SaleOrderRepository {
  constructor(
    @InjectRepository(SaleOrderOrmEntity) private readonly repo: Repository<SaleOrderOrmEntity>,
  ) {}

  async findAll(status?: OrderStatus): Promise<SaleOrder[]> {
    const rows = await this.repo.find({ where: status ? { status } : {} });
    return rows.map((row) => this.toDomain(row));
  }

  async findByUserSteamId(userSteamId: string): Promise<SaleOrder[]> {
    const rows = await this.repo.find({ where: { userSteamId } });
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<SaleOrder | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async save(order: SaleOrder): Promise<void> {
    await this.repo.save(this.toOrm(order));
  }

  private toDomain(row: SaleOrderOrmEntity): SaleOrder {
    return SaleOrder.restore({
      id: row.id,
      userSteamId: row.userSteamId,
      userDisplayName: row.userDisplayName,
      tradeUrl: row.tradeUrl,
      lineItems: row.lineItems,
      status: row.status,
      createdAt: row.createdAt,
    });
  }

  private toOrm(order: SaleOrder): SaleOrderOrmEntity {
    const row = new SaleOrderOrmEntity();
    row.id = order.id;
    row.userSteamId = order.userSteamId;
    row.userDisplayName = order.userDisplayName;
    row.tradeUrl = order.tradeUrl;
    row.lineItems = order.lineItems;
    row.status = order.status;
    row.createdAt = order.createdAt;
    return row;
  }
}
