# Auth — Steam OpenID conectado, falta la API key real

Lo que **ya existe y funciona** (verificado sin la API key real hasta donde se pudo):
- `domain/entities/user.entity.ts` — entidad User con rol (`customer` | `admin`).
- `domain/ports/user.repository.port.ts` + `infrastructure/persistence/in-memory-user.repository.ts`.
- `infrastructure/steam/steam.strategy.ts` — estrategia de `passport-steam` real.
- `GET /auth/steam` → redirige de verdad a `steamcommunity.com/openid/login` (probado: la URL de redirect se arma bien).
- `GET /auth/steam/return` → cuando Steam vuelve acá, busca o crea el `User` por su SteamID y emite la cookie de sesión. **Esta parte no se pudo probar de punta a punta sin una `STEAM_API_KEY` real + un login real.**
- `POST /auth/logout` — borra la cookie.
- `GET /auth/me` — devuelve el usuario logueado (protegido con `JwtAuthGuard`).
- Sesión en **cookie httpOnly** (`pantera_session`, `SameSite=Lax`, `Secure` solo en producción) — decidido así con Ricardo por seguridad (JS del frontend no puede leerla). CORS configurado con `credentials: true` para que viaje en los requests del frontend.
- `POST /auth/dev-token { role }` sigue funcionando igual (emite JWT de prueba + la misma cookie), útil para seguir probando `catalog`/`orders` sin depender de Steam. Se autodesactiva en producción.

## Para que el login real funcione, falta

1. **Conseguir la Steam API Key** en https://steamcommunity.com/dev/apikey (logueado con la cuenta de Steam de la empresa o la que se use para la app). Pide un dominio: `localhost` en desarrollo, el dominio real en producción.
2. Ponerla en `.env` como `STEAM_API_KEY=...` (nunca en el código ni en el repo).
3. Ajustar `STEAM_RETURN_URL` y `STEAM_REALM` en `.env` cuando se despliegue a producción (hoy apuntan a `localhost:3001` por defecto).
4. Loguearse de verdad una vez para confirmar que `GET /auth/steam/return` crea el usuario y deja la cookie — no se pudo verificar esta parte en este entorno.
5. Conectar el frontend: botón "Iniciar sesión con Steam" en `app/login/page.tsx` debe apuntar a `GET {BACKEND_URL}/auth/steam` (navegación completa del navegador, no un `fetch` — es un redirect real a Steam).
6. Decidir si conviene refrescar `displayName`/`avatarUrl` cada vez que un usuario ya existente vuelve a loguearse (hoy solo se usan los datos guardados la primera vez) — queda un TODO en `auth.controller.ts`.
7. Reemplazar `InMemoryUserRepository` por un adaptador real (Postgres/TypeORM) implementando el mismo `UserRepository` — no hay que tocar nada de `domain/` ni de los guards para eso.
