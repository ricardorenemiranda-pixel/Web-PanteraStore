import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import SteamAuthStrategy from 'passport-steam';
import { AppConfig } from '../../../../config/configuration';

export interface SteamValidatedProfile {
  steamId: string;
  displayName: string;
  avatarUrl: string;
}

/**
 * Adaptador de infraestructura: traduce el flujo de OpenID de Steam (que
 * maneja la librería passport-steam) a algo que el resto del backend puede
 * usar. Nada fuera de este archivo sabe cómo funciona el login de Steam por
 * dentro — el controller solo recibe un SteamValidatedProfile ya limpio.
 */
@Injectable()
export class SteamStrategy extends PassportStrategy(SteamAuthStrategy, 'steam') {
  constructor(configService: ConfigService<AppConfig, true>) {
    const steamConfig = configService.get('steam', { infer: true });
    super({
      returnURL: steamConfig.returnUrl,
      realm: steamConfig.realm,
      apiKey: steamConfig.apiKey,
    });
  }

  validate(
    _identifier: string,
    profile: { id: string; displayName: string; photos: Array<{ value: string }> },
  ): SteamValidatedProfile {
    return {
      steamId: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[2]?.value ?? profile.photos?.[0]?.value ?? '',
    };
  }
}
