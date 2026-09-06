import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { UserRepository } from '../../domain/ports/user.repository.port';
import { UserOrmEntity } from './orm/user.orm-entity';

@Injectable()
export class TypeOrmUserRepository implements UserRepository, OnModuleInit {
  constructor(
    @InjectRepository(UserOrmEntity) private readonly repo: Repository<UserOrmEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) return;

    await this.save(
      User.create({
        id: 'admin-1',
        steamId: '76561198000000001',
        displayName: 'PanteraStore Admin',
        role: 'admin',
      }),
    );
    await this.save(
      User.create({
        id: 'customer-1',
        steamId: '76561198000000002',
        displayName: 'Liquid_Nisha',
        role: 'customer',
      }),
    );
  }

  async findBySteamId(steamId: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { steamId } });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    await this.repo.save(this.toOrm(user));
  }

  private toDomain(row: UserOrmEntity): User {
    return User.create({
      id: row.id,
      steamId: row.steamId ?? undefined,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl ?? undefined,
      role: row.role,
      tradeUrl: row.tradeUrl ?? undefined,
      email: row.email ?? undefined,
      passwordHash: row.passwordHash ?? undefined,
    });
  }

  private toOrm(user: User): UserOrmEntity {
    const row = new UserOrmEntity();
    row.id = user.id;
    row.steamId = user.steamId ?? null;
    row.displayName = user.displayName;
    row.avatarUrl = user.avatarUrl ?? null;
    row.role = user.role;
    row.tradeUrl = user.tradeUrl ?? null;
    row.email = user.email ?? null;
    row.passwordHash = user.passwordHash ?? null;
    return row;
  }
}
