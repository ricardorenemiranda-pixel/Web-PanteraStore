import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Dispara el flujo de OpenID de Steam. En /auth/steam redirige al login de
 * Steam; en /auth/steam/return valida la respuesta de Steam y llena
 * request.user con el SteamValidatedProfile (ver steam.strategy.ts).
 */
@Injectable()
export class SteamAuthGuard extends AuthGuard('steam') {}
