# Confianza y seguridad: reportes, sanciones, disputas y antifraude

## Piezas

```
REPORTE     jugador reporta a otro (categoría + descripción + evidencia opcional) ─► "pendiente"
            admin revisa ─► "Resolver" (opcionalmente con la sanción que aplicó) ─► "resuelto"
                          └► "Descartar" (con motivo) ─► "descartado"

SANCIÓN     admin la aplica a un usuario: advertencia | multa | suspensión
            multa    ─► descuenta saldo REAL de inmediato (falla si no alcanza)
            suspensión ─► bloquea crear/unirse a salas hasta que venza o se revoque
            revocar  ─► deshace el bloqueo; si era multa, devuelve el dinero

DISPUTA     un jugador de LA PARTIDA impugna su resultado, dentro de un plazo tras terminar
            admin "Aceptar" (upheld)  ─► se revierte TODA la liquidación: cada uno recupera su
                                          entrada, a quien ganó se le retira el premio, la
                                          plataforma devuelve su comisión. Partida queda "voided".
            admin "Rechazar"          ─► no cambia nada, el resultado se mantiene

ANTIFRAUDE  dos consultas de solo lectura para el admin:
            - cuentas que comparten IP de login o destino de retiro
            - pares de jugadores que casi siempre quedan en el mismo equipo y uno gana casi
              siempre cuando van juntos (posible acuerdo / "farming")

AUDITORÍA   toda acción de admin de este módulo queda en una bitácora de solo escritura
            (quién, qué, cuándo, sobre qué, con qué detalle)
```

## Cómo se resuelve una disputa aceptada (importante)

**No se redeclara un ganador distinto.** Aceptar una disputa siempre significa "esta liquidación
fue injusta o inválida": se deshace por completo (todos recuperan su entrada, nadie se queda con
el premio, la plataforma devuelve su comisión) y la partida queda anulada. Se decidió así a
propósito: adivinar quién ganó *de verdad* sin datos confiables del juego (sin integración real
con la API de Dota 2 para verificar resultados) sería inventar un resultado. Si en el futuro hay
una fuente de verdad del resultado (ver limitación de Sprint 3 en `rooms/README.md`), ahí sí tendría
sentido poder "corregir el ganador" en vez de solo anular.

La reversión usa movimientos `ADJUSTMENT` (no los de sala normales), porque el ciclo
bloqueo→cobro→premio ya se cerró cuando la disputa se resuelve. Es **idempotente**: si por algún
motivo se reintenta la reversión de una liquidación ya revertida, no vuelve a mover dinero (se
verifica con una prueba que llama a `ReverseSettlementUseCase.execute` dos veces seguidas).

## Decisión de arquitectura: por qué no hay dependencia circular

`trust` necesita revertir liquidaciones, que viven en `rooms`. Pero `rooms` necesita saber si un
usuario está suspendido antes de dejarlo crear o unirse a una sala, y esa sanción vive en `trust`.
Dos módulos que se necesitan mutuamente en NestJS es una dependencia circular. Se resolvió sin
`forwardRef` (que además no habría alcanzado, porque el problema real es de *datos*, no solo de
inyección):

- **`ReverseSettlementUseCase` vive DENTRO de `rooms`** (usa sus propios repositorios de sala,
  partida y liquidación) **y se exporta**. `trust` lo importa y lo usa desde `ResolveDisputeUseCase`,
  una sola dirección: `trust → rooms`.
- **`SuspensionGate` vive en el `SharedModule` global**, no en `trust`. Es una consulta SQL
  deliberadamente pequeña y duplicada (repite lo que ya hace
  `TrustRepository.findActiveSuspension`) contra la tabla `sanctions`, para que `rooms` pueda
  preguntar "¿está suspendido?" sin importar `trust` en absoluto.

El costo es esa pequeña duplicación de una consulta. La alternativa (una tercera dependencia
mutua, o mover la lógica de salas dentro de `trust`) hubiera sido peor para la separación de
responsabilidades.

## Reglas (todas con pruebas contra Postgres real)

- **Nadie se reporta a sí mismo.**
- **Evidencia:** igual que en pagos — solo imágenes PNG/JPG/WEBP por sus primeros bytes, máximo 2 MB,
  servida solo a admins con `nosniff`. Contiene datos personales: mismo cuidado que los comprobantes.
- **Un reporte/disputa ya resuelto no se puede volver a resolver** (protege contra doble sanción o
  doble reversión de dinero).
- **Una partida, una disputa:** índice único por `matchId`.
- **Plazo de disputa:** `DISPUTE_WINDOW_HOURS` (por defecto 48h) desde que terminó la partida.
- **Multa sin fondos suficientes se rechaza entera** (no se aplica "a medias" ni queda sanción
  huérfana sin cobrar).
- **Revocar una sanción ya revocada falla** — no se puede devolver el dinero de una multa dos veces.
- **Suspensión con fecha de fin deja de bloquear sola** al vencer (no hace falta que un admin la
  revoque); una revocada deja de bloquear al instante.
- **Todo movimiento de dinero de este módulo (multa, reversión) exige un motivo** y queda en el
  libro de la billetera para siempre, igual que cualquier otro movimiento.

## Antifraude: qué detecta y qué no

- **Cuentas duplicadas:** agrupa por IP de login (`users.lastLoginIp`, se guarda en cada login) y por
  destino de retiro (`withdrawal_requests.destination`). Es una señal, no una prueba: redes
  compartidas (universidad, cabina de internet, NAT de operador móvil) también coinciden.
- **Colusión ("farming"):** pares de jugadores que compartieron equipo en al menos 5 partidas
  terminadas, donde uno de los dos ganó el 85% o más de esas veces juntos. Ambos umbrales están
  fijos en el código (`admin/fraud/collusion` llama con `(5, 0.85)`) — con más historial real de
  partidas convendría hacerlos configurables y ajustar los valores con datos reales.
- Ninguna de las dos consultas **actúa sola**: solo informan al admin, que decide si sanciona.

## Lo que NO hace (todavía)

- No verifica identidad para el antifraude de "una persona, una cuenta" — solo cruza señales
  indirectas (IP, destino de retiro). No hay verificación de documento ni biometría.
- La suspensión bloquea **crear/unirse a salas** (desde el Sprint 6) y, desde el Sprint 7, también
  **enviar mensajes en el chat general** (`SendChatMessageUseCase` usa el mismo `SuspensionGate`). No
  bloquea depósitos ni retiros — se decidió así porque cobrarle a alguien suspendido y no dejarlo
  retirar su propio dinero sería más grave que dejarlo jugar o hablar; si el riesgo real termina siendo
  el retiro (lavado, revertir un fraude), esto habría que revisarlo.
- **La aceptación de términos tampoco está conectada a pagos.** `PaymentsPolicy.requirePlayer()`
  (`payments/application/use-cases/payment-use-cases.ts`) solo exige mayoría de edad y Steam
  vinculado — no revisa `hasAcceptedTerms`. Hoy el gate de términos solo se aplica a crear/unirse a
  salas. Si los términos cubren también el manejo del dinero (que probablemente deberían), falta
  agregar la misma verificación ahí.
- El registro de auditoría **solo cubre las acciones nuevas de este módulo** (sanciones, reportes,
  disputas). Las acciones de admin de sprints anteriores (aprobar/rechazar depósitos y retiros,
  decidir o anular una partida, acreditar saldo de prueba) todavía NO pasan por la bitácora — quedó
  fuera de alcance de este sprint, es una brecha conocida.
- No hay límite de cuántos reportes puede crear un mismo usuario (podría usarse para acosar a otro
  jugador con reportes falsos repetidos) — el admin los revisa uno por uno, pero no hay throttling.
- La detección de colusión no distingue "compañeros de equipo habituales que juegan bien juntos" de
  un acuerdo real para perder — el admin tiene que mirar el historial antes de sancionar.
