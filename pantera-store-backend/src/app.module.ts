import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppConfig } from './config/configuration';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { DomainExceptionFilter } from './shared/interface/filters/domain-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        type: 'postgres' as const,
        url: configService.get('database', { infer: true }).url,
        autoLoadEntities: true,
        // Sin migraciones todavía (ver DEPLOYMENT.md) — razonable mientras no
        // hay datos reales en producción, pero hay que reemplazarlo antes de
        // un despliegue real.
        synchronize: configService.get('nodeEnv', { infer: true }) !== 'production',
      }),
    }),
    // Job de sincronización de precios (ver catalog/infrastructure/scheduler).
    ScheduleModule.forRoot(),
    // Capa de seguridad "perímetro": límite de requests por IP, antes de
    // que cualquier request llegue a un controller.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    CatalogModule,
    OrdersModule,
    InventoryModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
