import { Global, Injectable, Module } from '@nestjs/common';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  type TransactionContext,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '../application/unit-of-work';
import { AUDIT_LOG } from '../audit/domain/audit-log.port';
import { AuditLogOrmEntity } from '../audit/infrastructure/orm/audit-log.orm-entity';
import { TypeOrmAuditLog } from '../audit/infrastructure/typeorm-audit-log';
import { ACTIVITY_FEED } from '../activity/domain/activity-feed.port';
import { ActivityFeedOrmEntity } from '../activity/infrastructure/orm/activity-feed.orm-entity';
import { TypeOrmActivityFeed } from '../activity/infrastructure/typeorm-activity-feed';
import { SuspensionGate } from '../trust/suspension-gate';

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      work(manager as unknown as TransactionContext),
    );
  }
}

/** Solo las implementaciones de TypeORM saben abrir el handle opaco. */
export function managerOf(tx: TransactionContext): EntityManager {
  return tx as unknown as EntityManager;
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogOrmEntity, ActivityFeedOrmEntity])],
  providers: [
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: AUDIT_LOG, useClass: TypeOrmAuditLog },
    { provide: ACTIVITY_FEED, useClass: TypeOrmActivityFeed },
    SuspensionGate,
  ],
  exports: [UNIT_OF_WORK, AUDIT_LOG, ACTIVITY_FEED, SuspensionGate],
})
export class SharedModule {}
