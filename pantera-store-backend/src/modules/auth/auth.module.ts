import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../../config/configuration';
import { USER_REPOSITORY } from './domain/ports/user.repository.port';
import { SteamStrategy } from './infrastructure/steam/steam.strategy';
import { UserOrmEntity } from './infrastructure/persistence/orm/user.orm-entity';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm-user.repository';
import { AuthController } from './interface/http/auth.controller';
import { JwtAuthGuard } from './interface/guards/jwt-auth.guard';
import { RolesGuard } from './interface/guards/roles.guard';
import { SteamAuthGuard } from './interface/guards/steam-auth.guard';
import { AcceptTermsUseCase } from './application/use-cases/accept-terms.use-case';
import { ConfirmAdultUseCase } from './application/use-cases/confirm-adult.use-case';
import { LoginWithPasswordUseCase } from './application/use-cases/login-with-password.use-case';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { UpdateTradeUrlUseCase } from './application/use-cases/update-trade-url.use-case';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity]),
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        secret: configService.get('jwtSecret', { infer: true }),
        signOptions: { expiresIn: configService.get('jwtExpiresIn', { infer: true }) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    SteamStrategy,
    JwtAuthGuard,
    RolesGuard,
    SteamAuthGuard,
    UpdateTradeUrlUseCase,
    RegisterUserUseCase,
    LoginWithPasswordUseCase,
    ConfirmAdultUseCase,
    AcceptTermsUseCase,
  ],
  // Se exportan para que catalog/orders puedan proteger sus propias rutas
  // (@UseGuards(JwtAuthGuard, RolesGuard)) y leer el usuario real (ej. para
  // el displayName de una orden, o el trade URL guardado) sin duplicar esto.
  exports: [JwtModule, JwtAuthGuard, RolesGuard, USER_REPOSITORY],
})
export class AuthModule {}
