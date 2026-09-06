import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  // --- Capas de seguridad, en el orden en que se aplican a cada request ---

  // 1) Cabeceras HTTP seguras (perímetro).
  app.use(helmet());

  // 2) CORS: solo el frontend configurado puede llamar a esta API, y con
  //    `credentials: true` para que el navegador mande/reciba la cookie de
  //    sesión (ver auth.controller.ts) en requests cross-origin.
  app.enableCors({
    origin: configService.get('corsOrigin', { infer: true }),
    credentials: true,
  });

  // Lee la cookie httpOnly de sesión (JwtAuthGuard) en cada request.
  app.use(cookieParser());

  // TODO(debug): logger temporal para depurar el login de Steam, sacar
  // después de que /auth/steam/return funcione de punta a punta.
  app.use((req: import('express').Request, res: import('express').Response, next: () => void) => {
    const start = Date.now();
    res.on('finish', () => {
      // eslint-disable-next-line no-console
      console.log(`[debug] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });

  // 3) Validación/whitelisting de todo el body/query/params antes de que
  //    lleguen a un controller (ver los *.dto.ts de cada módulo). Cualquier
  //    campo no declarado en el DTO se descarta o rechaza, nunca pasa.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // El resto de capas (JwtAuthGuard, RolesGuard, invariantes de dominio) se
  // aplican por endpoint — ver src/modules/*/interface.

  // Deja que Nest cierre conexiones (DB, Redis, etc.) prolijamente cuando
  // Coolify manda SIGTERM para reiniciar/actualizar el contenedor, en vez
  // de cortar requests a la mitad.
  app.enableShutdownHooks();

  const port = configService.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`PanteraStore backend escuchando en http://localhost:${port}`);
}
bootstrap();
