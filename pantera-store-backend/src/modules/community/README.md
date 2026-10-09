# Experiencia y retención: chat, feed, rankings y notificaciones

Estas piezas viven repartidas en varios módulos (`chat`, `community`, `stats`, y ganchos dentro de
`rooms`/`wallet`/`trust`), pero se pensaron juntas — este doc las cubre a todas.

## Piezas

```
CHAT        un chat general del sitio (una sola sala global, por WebSocket). Bloquea a
            suspendidos y aplica un límite simple de mensajes por minuto.

FEED        "qué está pasando": premios, bonos y sanciones, en tiempo casi real (se lee por
            HTTP; no tiene su propio WebSocket todavía — ver "Lo que NO hace").

RANKINGS    victorias, % de victorias y ganancia neta por jugador, calculado al vuelo desde
            las partidas y liquidaciones ya guardadas (no hay una tabla de estadísticas aparte).

VISTA EN VIVO  la partida en curso muestra tiempo transcurrido y presencia de jugadores — NO
            un marcador real, porque no hay conexión con la partida de Dota 2 (ver rooms/README.md).

NOTIFICACIONES  "sala llena" / "partida lista", derivadas en el FRONTEND del mismo stream
            público de salas que ya existía (room:updated) — no se creó backend nuevo para esto.

DISCORD     un enlace configurable (`DISCORD_INVITE_URL`), mostrado en /comunidad si existe.
```

## Chat: autenticación de WebSocket desde cero

`RoomsGateway` (Sprint 2) es de solo lectura — nunca necesitó saber quién está conectado. El chat sí,
porque cada mensaje tiene que quedar atribuido a alguien. `ChatGateway` (`src/modules/chat/interface/ws/chat.gateway.ts`)
lee la cookie de sesión (`pantera_session`) directamente del *handshake* del socket (Socket.IO no trae
`cookie-parser`, así que se parsea a mano) y verifica el JWT con el mismo `JwtService` que usa la API
HTTP. Sin cookie válida, el socket se desconecta al instante — no hay una zona intermedia de "conectado
pero no identificado".

## Reglas (con pruebas contra Postgres real)

- **Suspendido no puede chatear.** Mismo `SuspensionGate` que bloquea salas desde el Sprint 6 —
  ver `trust/README.md`.
- **Límite de mensajes:** `CHAT_RATE_LIMIT` mensajes cada `CHAT_RATE_LIMIT_WINDOW_SEC` segundos por
  usuario (por defecto 5 cada 10s). Vive **en memoria del proceso** — con más de una instancia del
  backend a la vez, cada una tendría su propio contador. Si el backend llega a correr en varias
  instancias, esto hay que moverlo a Redis (que ya está en el stack, pero no se usa acá todavía).
- **Los mensajes nunca se editan ni se borran** (ver `chat_messages`), igual que el libro de la
  billetera o la auditoría.
- **El feed nunca expone datos sensibles de una sanción.** El mensaje que arma
  `ApplySanctionUseCase` dice el TIPO ("recibió una suspensión") pero nunca el motivo ni el monto —
  ver la nota de privacidad en `trust/README.md`.
- **Rankings excluyen lo que no cuenta:** partidas `voided`/`failed` (no terminaron de verdad) y
  liquidaciones con `reversedAt` (revertidas por una disputa aceptada) no suman ni a victorias ni a
  ganancia neta — probado explícitamente revirtiendo una liquidación y verificando que el jugador
  desaparece del ranking.

## Por qué el feed de actividad vive en `shared/`

Igual que `AuditLog` (Sprint 6): `ACTIVITY_FEED` es un puerto global registrado en `SharedModule`
(`src/shared/activity/`), no un servicio de `community`. La razón es la misma que ya resolvió el
problema de dependencia circular de `trust`↔`rooms`: quien genera el evento (`SettleMatchUseCase` en
`rooms`, `ApplySanctionUseCase` en `trust`, `GrantBonusUseCase` en `wallet`) inyecta el puerto
directamente, sin que ningún módulo de negocio tenga que importar `community` solo para anunciar algo.
`community` únicamente LEE el feed (`GET /community/feed`) — nunca escribe en él directamente.

## `GrantBonusUseCase` vs. saldo de prueba

`wallet/admin/test-credit` (desde el piloto) sigue existiendo para desarrollo/pruebas y **no** se
anuncia en el feed. `wallet/admin/bonus` (nuevo) es dinero real, pensado para usarse de verdad, y
siempre queda anunciado en el feed público y en la auditoría — son dos herramientas
deliberadamente distintas, no una reetiquetada de la otra.

## Lo que NO hace (todavía)

- **El feed de actividad no tiene WebSocket propio.** La página `/comunidad` lo carga por HTTP al
  entrar; si alguien más gana un premio mientras la tienes abierta, no aparece hasta que recargues.
  Se decidió así para no triplicar la complejidad de autenticación de sockets en un solo sprint — el
  chat ya la resuelve una vez, y el feed es menos urgente en tiempo real que un mensaje de chat.
- **Las notificaciones de "sala llena"/"partida lista" son solo del navegador (Notification API +
  aviso en pantalla), no push real a un teléfono con la app cerrada** — no hay Service Worker ni
  suscripción push todavía.
- **No hay moderación de contenido del chat** (palabras prohibidas, spam más allá del límite de
  frecuencia, reportar un mensaje puntual). Reportar a un jugador sigue existiendo desde el Sprint 6,
  pero apunta a una partida, no a un mensaje de chat.
- **El chat es una sola sala global.** No hay salas de chat por partida ni mensajes privados.
- **Los mensajes del chat no tienen límite de retención** — la tabla `chat_messages` crece sin
  límite, igual que `activity_feed`. Ninguna de las dos tiene todavía un job de limpieza (hay
  `ScheduleModule` ya en el proyecto para el sync de precios, así que agregar uno sería sencillo).
- **El ranking no tiene una ventana de tiempo** (ej. "esta semana"): es acumulado desde siempre. Con
  más volumen real de partidas, convendría agregar un filtro de fecha.
