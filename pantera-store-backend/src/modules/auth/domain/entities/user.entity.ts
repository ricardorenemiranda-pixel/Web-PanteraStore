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
  /** Fecha de nacimiento declarada (YYYY-MM-DD). Solo existe si confirmó ser mayor de edad. */
  birthDate?: string;
  /** Cuándo confirmó que es mayor de 18. Sin esto no puede jugar con dinero ni recargar. */
  adultConfirmedAt?: Date;
  /** Versión de los Términos que aceptó (ver config.terms.version). Sin esto no puede jugar ni mover dinero. */
  termsAcceptedVersion?: number;
  termsAcceptedAt?: Date;
  /** Última IP con la que inició sesión — solo para detectar cuentas duplicadas, nunca se muestra al usuario. */
  lastLoginIp?: string;
}

export const ADULT_AGE = 18;

/** Años cumplidos a `now` para una fecha YYYY-MM-DD; null si la fecha no es válida. */
export function ageOn(birthDate: string, now: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const born = new Date(Date.UTC(year, month - 1, day));
  // Rechaza fechas imposibles (30 de febrero): JS las "corrige" en silencio.
  if (born.getUTCFullYear() !== year || born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) {
    return null;
  }
  if (born.getTime() > now.getTime()) return null;
  let age = now.getUTCFullYear() - year;
  const birthdayPassed =
    now.getUTCMonth() > month - 1 || (now.getUTCMonth() === month - 1 && now.getUTCDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age;
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

  get birthDate(): string | undefined {
    return this.props.birthDate;
  }

  get adultConfirmedAt(): Date | undefined {
    return this.props.adultConfirmedAt;
  }

  /** ¿Confirmó que es mayor de 18? */
  isAdult(): boolean {
    return this.props.adultConfirmedAt !== undefined;
  }

  /**
   * Declaración de mayoría de edad. Es una declaración del propio usuario
   * (no una verificación de identidad): sirve como primer filtro, no como
   * prueba legal de edad.
   */
  confirmAdult(birthDate: string, now: Date = new Date()): void {
    const age = ageOn(birthDate, now);
    if (age === null) {
      throw new InvalidDomainStateException('La fecha de nacimiento no es válida (usa AAAA-MM-DD).');
    }
    if (age < ADULT_AGE) {
      throw new InvalidDomainStateException(`Debes tener al menos ${ADULT_AGE} años para jugar con dinero.`);
    }
    this.props.birthDate = birthDate;
    this.props.adultConfirmedAt = now;
  }

  get termsAcceptedVersion(): number | undefined {
    return this.props.termsAcceptedVersion;
  }

  get termsAcceptedAt(): Date | undefined {
    return this.props.termsAcceptedAt;
  }

  get lastLoginIp(): string | undefined {
    return this.props.lastLoginIp;
  }

  hasAcceptedTerms(currentVersion: number): boolean {
    return this.props.termsAcceptedVersion !== undefined && this.props.termsAcceptedVersion >= currentVersion;
  }

  acceptTerms(version: number, now: Date = new Date()): void {
    if (!Number.isInteger(version) || version < 1) {
      throw new InvalidDomainStateException('Versión de términos no válida.');
    }
    this.props.termsAcceptedVersion = version;
    this.props.termsAcceptedAt = now;
  }

  recordLoginIp(ip: string | undefined): void {
    this.props.lastLoginIp = ip || undefined;
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
