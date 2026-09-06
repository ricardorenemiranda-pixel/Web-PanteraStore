import { InvalidDomainStateException } from '../../../../shared/domain/exceptions/domain.exception';

export type UserRole = 'customer' | 'admin';

export interface UserProps {
  id: string;
  /** Ausente hasta que el usuario vincula su cuenta de Steam. */
  steamId?: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  /** Trade URL guardado para no tener que volver a pegarlo en cada venta. */
  tradeUrl?: string;
  /** Ausente si la cuenta todavía no vinculó Steam (login solo por Steam, sin registro local). */
  email?: string;
  /** Ausente si la cuenta se creó solo vía Steam, sin registro local. */
  passwordHash?: string;
}

const STEAM_TRADE_URL_PATTERN = /^https:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+&token=\w+$/;

/**
 * El usuario de dominio no sabe qué es un JWT ni una cookie de sesión —
 * eso es responsabilidad de la capa de interfaz (guards). Acá solo vive la
 * identidad, el rol, y el trade URL que el usuario decide guardar.
 */
export class User {
  private constructor(private props: UserProps) {}

  static create(props: UserProps): User {
    if (props.tradeUrl) {
      User.validateTradeUrl(props.tradeUrl);
    }
    return new User(props);
  }

  get id(): string {
    return this.props.id;
  }

  get steamId(): string | undefined {
    return this.props.steamId;
  }

  get email(): string | undefined {
    return this.props.email;
  }

  get passwordHash(): string | undefined {
    return this.props.passwordHash;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get tradeUrl(): string | undefined {
    return this.props.tradeUrl;
  }

  isAdmin(): boolean {
    return this.props.role === 'admin';
  }

  updateTradeUrl(tradeUrl: string): void {
    User.validateTradeUrl(tradeUrl);
    this.props.tradeUrl = tradeUrl;
  }

  /**
   * Vincula una cuenta de Steam a un usuario que ya existe (registro local
   * previo). No pisa el displayName que el usuario eligió al registrarse —
   * solo agrega el steamId y trae su avatar de Steam.
   */
  linkSteamAccount(steamId: string, avatarUrl?: string): void {
    this.props.steamId = steamId;
    this.props.avatarUrl = avatarUrl;
  }

  /** Refresca nombre/avatar/rol tras un login con Steam (pueden cambiar entre sesiones). */
  syncFromSteamProfile(displayName: string, avatarUrl: string | undefined, role: UserRole): void {
    this.props.displayName = displayName;
    this.props.avatarUrl = avatarUrl;
    this.props.role = role;
  }

  private static validateTradeUrl(tradeUrl: string): void {
    if (!STEAM_TRADE_URL_PATTERN.test(tradeUrl)) {
      throw new InvalidDomainStateException(
        'El Trade URL no tiene el formato válido de Steam (steamcommunity.com/tradeoffer/new/?partner=...&token=...).',
      );
    }
  }
}
