import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserRole } from '../../domain/entities/user.entity';
import { SESSION_COOKIE_NAME } from '../constants';

export interface RequestUser {
  userId: string;
  /** Ausente si la cuenta todavía no vinculó Steam (registro local puro). */
  steamId?: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
}

/**
 * Primera capa de seguridad tras la validación de input: confirma que hay un
 * JWT válido antes de que la request llegue al controller. Este guard NO
 * decide permisos (eso es RolesGuard) — solo responde "¿quién sos?".
 *
 * El login real con Steam (ver interface/http/auth.controller.ts) manda el
 * JWT en una cookie httpOnly. También se acepta por header
 * "Authorization: Bearer" (lo usa /auth/dev-token y sirve para probar con
 * curl/Postman) — el guard prueba la cookie primero.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Falta el token de autenticación.');
    }

    try {
      request.user = this.jwtService.verify<RequestUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }

  private extractToken(request: AuthenticatedRequest): string | null {
    const cookieToken = (request.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE_NAME
    ];
    if (cookieToken) {
      return cookieToken;
    }

    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    return null;
  }
}
