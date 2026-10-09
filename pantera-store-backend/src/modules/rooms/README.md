# Salas y partidas

Cómo se juega una sala de Dota 2 y qué se puede (y qué no) automatizar.

## Flujo

```
sala llena ──► abre lobby ──► esperan jugadores ──► lanza ──► en juego ──► hay ganador
   │              │                  │                                       │
   │              │                  └─ nadie llega a tiempo ─► cancela y REEMBOLSA a todos
   │              └─ el bot no logra abrirlo (5 intentos) ─────► cancela y REEMBOLSA a todos
   └─ alguien sale / se cancela la sala antes de empezar ──────► el lobby se descarta
```

- Los equipos se reparten **al azar** al llenarse la sala (Radiant/Dire iguales).
- El dinero se mueve en dos momentos: los **reembolsos** cuando una partida no se juega, y la **liquidación**
  cuando hay ganador (ver abajo).
- Todo el estado vive en la base de datos: si el servidor se reinicia, el orquestador retoma lo pendiente
  (revisa cada `MATCH_POLL_INTERVAL_SEC` segundos). Pensado para **una sola instancia** del backend.

## Liquidación (cómo se reparte el dinero)

Apenas una partida tiene ganador (registrado por el bot o por un admin) se liquida **sola**, en UNA transacción:

1. Se cobra la entrada de cada jugador (sale de "bloqueado").
2. La bolsa (entradas − comisión) se reparte **por igual** entre los ganadores.
3. La plataforma recibe la comisión **más los céntimos sobrantes** de dividir la bolsa (nunca desaparecen).
4. La sala pasa a "terminada" y queda un registro inmutable (`settlements`) con el detalle de cada jugador.

Ejemplo: 4 jugadores × S/ 11 = S/ 44 → comisión 10% (S/ 4.40) → 2 ganadores cobran S/ 19.80 cada uno.

Garantías (todas con pruebas contra Postgres real):

- **Siempre** `entradas = premios + plataforma`, al céntimo (`Settlement.create` lo verifica y, si no cuadra, se deshace todo).
- **Todo o nada:** si algo falla a mitad, no queda ningún movimiento; se reintenta solo en la siguiente revisión.
- **Idempotente:** liquidar dos veces (o cinco a la vez) paga una sola vez (`UNIQUE` en `settlements.matchId` + claves de idempotencia).
- **Empate o partida inválida:** el admin **anula** la partida (`POST /matches/:id/void`): nadie gana, la sala se cancela y
  se reembolsa a todos. Una partida ya pagada no se puede anular.
- La comisión llega a la billetera de la plataforma (`userId = 'platform'`), visible para el admin en `/admin/billetera`.
- Cada jugador ve su historial en `/mis-partidas` (ganó, perdió o fue reembolsado, con el neto de cada una).

## Modos (`MATCH_PROVIDER`)

| Valor    | Qué hace                                                                                       | Estado          |
| -------- | ---------------------------------------------------------------------------------------------- | --------------- |
| `manual` | Sin bot. La sala pasa a "jugando" y los jugadores se organizan por fuera. **Un admin** registra el ganador en `/admin/partidas`. | Listo (por defecto) |
| `fake`   | Lobby simulado en memoria, solo para desarrollo y pruebas. No se puede usar en producción.     | Listo           |
| `steam`  | Bot real de Steam que crea el lobby y lee el resultado.                                        | **No implementado** |

El resto del sistema depende solo de la interfaz `LobbyProvider`
(`domain/ports/lobby-provider.port.ts`). El bot real se enchufa ahí sin tocar reglas ni dinero.

## Por qué el bot de Steam todavía no existe

Investigado el 2026-09-25:

- `dota2` (npm, node-dota2) sí tiene `createPracticeLobby`, pero funciona sobre el cliente `steam` (node-steam),
  que ya no puede iniciar sesión con el sistema de autenticación actual de Steam.
- `dota2-user` (npm) funciona sobre `steam-user` (mantenido), pero es de bajo nivel: **no incluye** los mensajes
  para crear, expulsar ni lanzar un lobby. Habría que escribir esa capa contra el Game Coordinator de Valve.
- La alternativa mantenida con más funciones es `paralin/go-dota2` (Go): implicaría un servicio aparte.
- **Nada de esto se puede probar sin una cuenta de Steam dedicada.** Escribirlo a ciegas arriesga que baneen la cuenta.

Para retomarlo hace falta: una cuenta de Steam dedicada (que posea Dota 2, con Steam Guard) y decidir entre
(a) un servicio en Go, o (b) escribir los mensajes del GC sobre `dota2-user`.

## Riesgos y reglas de Valve (leer antes de usar dinero real)

- **Apuestas.** Valve ha declarado que usar el login de Steam (OpenID) y su API "para operar un negocio de
  apuestas no está permitido por nuestra API ni por nuestros acuerdos", y ha enviado cartas de cese a sitios
  de apuestas con skins de CS:GO y Dota. Si Valve considera que las salas con dinero son gambling, podrían
  cortar el login de Steam de **todo** PanteraStore (incluido el marketplace), no solo el de las salas.
  Es un riesgo de negocio/legal, no técnico. Consultar con un abogado y, si es posible, con Valve.
- **Automatización.** El Acuerdo de Suscriptor de Steam prohíbe automatizar el mercado de Steam con software
  no autorizado. No hay una regla explícita sobre bots que crean lobbies de Dota, pero las librerías avisan
  que Valve detecta este tráfico y que podría haber baneos (VAC). **Usar solo una cuenta dedicada,
  nunca una personal, y sin ninguna relación con la cuenta o API key del marketplace.**
- **Cuenta limitada.** Las cuentas nuevas de Steam pueden tener funciones restringidas hasta cumplir requisitos
  (gasto mínimo). No verificado para lobbies de Dota.

## Casos raros y qué hace el sistema

| Caso                                         | Comportamiento                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| Alguien que no es de la sala entra al lobby  | Se expulsa y no se cuenta.                                                     |
| Falta un jugador al vencer el plazo          | Partida `failed` (`players_no_show`), sala cancelada, **reembolso a todos**.   |
| Un jugador sale de la sala ya llena          | El lobby se descarta (`room_changed`); al volver a llenarse se abre otro.      |
| El creador cancela con el lobby abierto      | Se cierra el lobby, reembolso a todos.                                         |
| El bot no puede abrir el lobby               | 5 reintentos; luego se cancela la sala y se reembolsa (el dinero no se traba). |
| Se pierde el lobby esperando jugadores       | Partida `failed` (`lobby_lost`), reembolso a todos.                            |
| Se pierde el lobby en pleno juego            | La partida queda **para revisión**; un admin decide el ganador.                |
| La partida termina sin resultado confiable   | Igual: **para revisión**.                                                      |
| Un jugador abandona la partida               | Se registra en `abandonedUserIds`. **Aún no tiene consecuencia**: la política (multas, pérdida de premio) es del Sprint 6. |
| Mismo jugador en dos salas                   | No se permite (una sala viva por jugador).                                     |

## Lo que falta

- El bot real de Steam (ver arriba).
- Política de abandonos y multas (Sprint 6).
- Confirmación de mayoría de edad (18+) antes de jugar con dinero real.
