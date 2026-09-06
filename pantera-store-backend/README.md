# PanteraStore Backend

API de PanteraStore (marketplace de items de Dota 2), en NestJS + TypeScript,
con **arquitectura hexagonal** (puertos y adaptadores) y **seguridad por
capas**. Este documento explica cómo está organizado y por qué, para poder
seguir extendiéndolo de forma consistente.

Para cómo se despliega en el VPS de Hostinger (Coolify) y qué partes
escalan bien o no, ver [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Arquitectura hexagonal: qué va en cada carpeta

Cada bounded context (`catalog`, `auth`, `orders`, `inventory`) vive en
`src/modules/<nombre>/` con siempre la misma estructura de 4 capas:

```
modules/<nombre>/
  domain/           # El negocio puro. CERO imports de NestJS, Express, TypeORM, etc.
    entities/       # Clases con las reglas de negocio (invariantes) adentro.
    ports/          # Interfaces que el dominio necesita del mundo exterior
                     # (repositorios, gateways externos). Solo interfaces + un
                     # Symbol como token de inyección — nunca una implementación acá.
  application/      # Casos de uso: orquestan el dominio para cumplir una
    use-cases/       # acción concreta ("listar items", "aprobar una orden").
                     # Dependen de los puertos (interfaces), nunca de un
                     # adaptador concreto.
  infrastructure/   # Los adaptadores: implementaciones REALES de los puertos.
    persistence/     # Repositorios (hoy en memoria, después Postgres/TypeORM).
    steam/           # Llamadas reales a APIs de Steam.
  interface/        # La puerta de entrada HTTP: controllers, DTOs con
    http/            # class-validator, guards. Traduce HTTP <-> casos de uso.
  <nombre>.module.ts # Junta todo: qué adaptador concreto se usa para cada puerto.
```

**Regla de oro:** las flechas de dependencia siempre apuntan hacia adentro.
`interface` depende de `application`, `application` depende de `domain`.
`domain` no depende de nada. `infrastructure` implementa lo que `domain`
define (puertos), pero `domain` nunca importa nada de `infrastructure`.

**Por qué importa en la práctica:** hoy todos los repositorios son
"en memoria" (`InMemoryItemRepository`, etc.) para poder probar el flujo
completo sin tener Postgres corriendo. El día que se conecte la base de
datos real, se crea `infrastructure/persistence/typeorm/item.repository.ts`
implementando el mismo `ItemRepository` (el puerto), y se cambia una sola
línea en `catalog.module.ts` (`useClass: TypeOrmItemRepository`). Ni una
línea de `domain/` ni de `application/` se toca.

## Seguridad por capas

Cada request pasa por estas capas, en orden (una falla en cualquiera corta
la request antes de llegar a la siguiente):

1. **Perímetro** (`main.ts`): `helmet()` (cabeceras HTTP seguras), CORS
   restringido al origen del frontend, y `ThrottlerGuard` global (límite de
   requests por IP, contra fuerza bruta/DoS básico).
2. **Validación de input** (`main.ts` + cada `*.dto.ts`): `ValidationPipe`
   global con `whitelist: true` — cualquier campo no declarado en el DTO se
   descarta, y los que sí están se validan con `class-validator` (formato de
   Trade URL, rangos de markup, etc.) antes de que un caso de uso los vea.
3. **Autenticación** (`JwtAuthGuard`, módulo `auth`): "¿quién sos?". Verifica
   el JWT y cuelga el usuario en `request.user`. No decide permisos.
4. **Autorización** (`RolesGuard` + `@Roles('admin')`): "¿tenés permiso para
   esto?". Se usa en los endpoints del panel de administración
   (`items/:id/markup`, `orders` de aprobar/rechazar, etc.).
5. **Invariantes de dominio** (dentro de las entidades, ej. `Item.validateMarkup`,
   `SaleOrder.validateTradeUrl`): la última línea de defensa — ni con un bug
   en las capas de arriba se puede dejar el sistema en un estado inválido
   (markup negativo, orden aprobada dos veces, etc.). Estos errores se
   traducen a HTTP limpio vía `DomainExceptionFilter`.

## Módulos y su estado

| Módulo | Estado | Notas |
|---|---|---|
| `catalog` | ✅ Completo | Items, markup global/por-item, sync de precio con Steam Market real (`SteamMarketHttpGateway`). |
| `orders` | ✅ Completo | Crear orden de venta (congela precios), listar/aprobar/rechazar (admin). |
| `auth` | ✅ Completo (falta la API key) | `passport-steam` conectado de verdad, sesión en cookie httpOnly, verificado con un login real. Solo falta que Ricardo cargue su `STEAM_API_KEY` real en `.env`. |
| `inventory` | ✅ Completo | Lee el inventario público real de Steam (sin bot), filtra a lo vendible (Mítico/Legendario/Inmortal/Arcano + tradeable) y calcula precio de recompra. Verificado con un SteamID real. |

Todos los repositorios son en memoria por ahora (se resetean al reiniciar el
servidor) — es intencional mientras no hay Postgres conectado.

## Cómo correrlo

```bash
npm install
cp .env.example .env   # ajustar valores si hace falta
npm run start:dev      # con watch mode
```

Servidor en `http://localhost:3001`. Rutas disponibles:

- `GET /health` — health check.
- `GET /items`, `GET /items/:id` — catálogo público.
- `POST /auth/dev-token { role: "admin" | "customer" }` — **solo desarrollo**,
  emite un JWT de prueba mientras no existe login real con Steam.
- `PATCH /items/:id/markup`, `PATCH /items/config/global-markup`,
  `PATCH /items/:id/sync-price` — admin.
- `POST /orders` — cualquier usuario logueado.
- `GET /orders`, `PATCH /orders/:id/approve`, `PATCH /orders/:id/reject` — admin.
- `GET /auth/steam`, `GET /auth/steam/return`, `POST /auth/logout`, `GET /auth/me` — login real con Steam.
- `GET /inventory/me` — inventario vendible del usuario logueado.

Probado manualmente end-to-end: sin token → 401, token de customer en ruta
de admin → 403, token de admin → funciona, e invariantes de dominio (ej.
aprobar una orden ya procesada) devuelven 400 con mensaje claro.

## Qué falta (en orden sugerido)

1. **`STEAM_API_KEY` real** en `.env` — sin eso `/auth/steam/return` no
   puede completar el login (ver `src/modules/auth/README.md`).
2. **Postgres + TypeORM** — reemplazar los repos en memoria. El esquema sale
   casi directo de las entidades de dominio ya escritas.
3. **Redis** — cachear precios de Steam Market y el inventario leído (Steam
   rate-limitea fuerte si se golpea seguido).
4. Terminar de conectar el frontend (`pantera-store-frontend/pantera-store-clean`)
   a estos endpoints reemplazando el resto de `lib/mock-data.ts` (catálogo,
   órdenes) — el login y el inventario ya están conectados.
