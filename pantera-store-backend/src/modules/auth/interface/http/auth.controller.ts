import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { AppConfig } from '../../../../config/configuration';
import { User, type UserRole } from '../../domain/entities/user.entity';
import { USER_REPOSITORY, type UserRepository } from '../../domain/ports/user.repository.port';
import { LoginWithPasswordUseCase } from '../../application/use-cases/login-with-password.use-case';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { UpdateTradeUrlUseCase } from '../../application/use-cases/update-trade-url.use-case';
import { CurrentUser } from '../decorators/current-user.decorator';
import { SESSION_COOKIE_NAME } from '../constants';
import { JwtAuthGuard, type RequestUser } from '../guards/jwt-auth.guard';
import type { SteamValidatedProfile } from '../../infrastructure/steam/steam.strategy';
import { SteamAuthGuard } from '../guards/steam-auth.guard';
import { DevTokenDto } from './dto/dev-token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateTradeUrlDto } from './dto/update-trade-url.dto';
import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

interface SteamCallbackRequest extends Express.Request {
  user: SteamValidatedProfile;
  cookies?: Record<string, string>;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly updateTradeUrl: UpdateTradeUrlUseCase,
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginWithPassword: LoginWithPasswordUseCase,
  ) {}

  /** Crea una cuenta local (sin Steam todavía — se vincula después desde el perfil). */
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReturnType<AuthController['toProfileResponse']>> {
    if (dto.password !== dto.confirmPassword) {
      throw new InvalidDomainStateException('Las contraseñas no coinciden.');
    }

    const user = await this.registerUser.execute({
      displayName: dto.displayName,
      email: dto.email,
      password: dto.password,
      tradeUrl: dto.tradeUrl,
    });

    this.issueSessionCookie(res, user);
    return this.toProfileResponse(user);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReturnType<AuthController['toProfileResponse']>> {
    const user = await this.loginWithPassword.execute(dto.email, dto.password);
    this.issueSessionCookie(res, user);
    return this.toProfileResponse(user);
  }

  /** El guard redirige a Steam para loguearse — este método nunca llega a ejecutarse. */
  @Get('steam')
  @UseGuards(SteamAuthGuard)
  loginWithSteam(): void {}

  /**
   * Steam vuelve acá tras un login exitoso, con la identidad ya verificada
   * por SteamAuthGuard (ver steam.strategy.ts). Si el navegador ya traía una
   * sesión local válida (el usuario le dio "Vincular cuenta de Steam" desde
   * su perfil), esta cuenta de Steam se vincula a ESE usuario en vez de
   * crear una cuenta aparte — funciona porque la cookie de sesión existente
   * viaja con el navegador durante todo el ida-y-vuelta con Steam. Si no
   * hay sesión previa, es un login directo con Steam (como siempre).
   */
  @Get('steam/return')
  @UseGuards(SteamAuthGuard)
  async steamReturn(@Req() req: SteamCallbackRequest, @Res() res: Response): Promise<void> {
    const profile = req.user;
    const adminSteamIds = this.configService.get('adminSteamIds', { infer: true });
    const role: UserRole = adminSteamIds.includes(profile.steamId) ? 'admin' : 'customer';

    const alreadyLinkedTo = await this.users.findBySteamId(profile.steamId);
    const sessionUser = await this.tryGetSessionUser(req);

    let user: User;
    if (sessionUser && (!alreadyLinkedTo || alreadyLinkedTo.id === sessionUser.id)) {
      // Vincular Steam a la cuenta local ya logueada (no pisa el displayName elegido al registrarse).
      sessionUser.linkSteamAccount(profile.steamId, profile.avatarUrl);
      await this.users.save(sessionUser);
      user = sessionUser;
    } else if (alreadyLinkedTo) {
      // Login normal de una cuenta que ya se había logueado con Steam antes
      // (con o sin registro local previo) — refresca nombre/avatar/rol.
      alreadyLinkedTo.syncFromSteamProfile(profile.displayName, profile.avatarUrl, role);
      await this.users.save(alreadyLinkedTo);
      user = alreadyLinkedTo;
    } else {
      user = User.create({
        id: randomUUID(),
        steamId: profile.steamId,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        role,
      });
      await this.users.save(user);
    }

    this.issueSessionCookie(res, user);

    const frontendUrl = this.configService.get('corsOrigin', { infer: true });
    res.redirect(frontendUrl);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() requestUser: RequestUser) {
    const user = await this.users.findById(requestUser.userId);
    if (!user) {
      throw new ForbiddenException('Usuario no encontrado.');
    }
    return this.toProfileResponse(user);
  }

  /** Guarda el Trade URL del usuario para no tener que volver a pegarlo en cada venta. */
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser() requestUser: RequestUser, @Body() dto: UpdateTradeUrlDto) {
    const user = await this.updateTradeUrl.execute(requestUser.userId, dto.tradeUrl);
    return this.toProfileResponse(user);
  }

  /**
   * TODO(auth-steam): borrar este endpoint (o dejarlo detrás de un flag
   * extra) una vez el login real con Steam esté probado en producción.
   * Mientras tanto emite un JWT válido de prueba para poder probar los
   * endpoints protegidos sin depender de un login real. Se autodesactiva
   * si NODE_ENV=production.
   */
  @Post('dev-token')
  async issueDevToken(
    @Body() dto: DevTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: { id: string; displayName: string; role: string } }> {
    if (this.configService.get('nodeEnv', { infer: true }) === 'production') {
      throw new ForbiddenException('Este endpoint no está disponible en producción.');
    }

    const steamId = dto.role === 'admin' ? '76561198000000001' : '76561198000000002';
    const user = await this.users.findBySteamId(steamId);
    if (!user) {
      throw new ForbiddenException('Usuario de prueba no encontrado.');
    }

    const accessToken = this.issueSessionCookie(res, user);
    return { accessToken, user: { id: user.id, displayName: user.displayName, role: user.role } };
  }

  private toProfileResponse(user: User) {
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      tradeUrl: user.tradeUrl,
      steamId: user.steamId,
      email: user.email,
    };
  }

  /**
   * Lee y valida la cookie de sesión que ya traía el navegador (si la hay),
   * sin lanzar si no hay o es inválida — a diferencia de JwtAuthGuard, acá
   * "no hay sesión" es un caso normal (login directo con Steam), no un error.
   */
  private async tryGetSessionUser(req: SteamCallbackRequest): Promise<User | null> {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token) return null;

    try {
      const payload = this.jwtService.verify<RequestUser>(token);
      return await this.users.findById(payload.userId);
    } catch {
      return null;
    }
  }

  private issueSessionCookie(res: Response, user: User): string {
    const accessToken = this.jwtService.sign({
      userId: user.id,
      steamId: user.steamId,
      role: user.role,
    });

    res.cookie(SESSION_COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get('nodeEnv', { infer: true }) === 'production',
      maxAge: SEVEN_DAYS_MS,
      path: '/',
    });

    return accessToken;
  }
}
