# Pagos: recargas y retiros (modo manual)

Todo el dinero real entra y sale **por fuera** (Yape, Plin, transferencia) y un administrador lo confirma.
El sistema no toca ninguna cuenta bancaria: solo lleva la contabilidad y evita errores.

## Flujo

```
RECARGA   jugador paga por fuera ─► sube comprobante + nº de operación ─► "en revisión"
          admin ve el dinero en SU cuenta ─► "Ya llegó: acreditar" ─► saldo acreditado (una sola vez)
                                          └► "Rechazar" (con motivo) ─► no pasa nada con el saldo

RETIRO    jugador pide monto + destino ─► el dinero se APARTA (disponible → bloqueado) ─► "en revisión"
          admin transfiere por fuera ─► "Ya pagué" + su nº de operación ─► el monto sale del sistema
                                     └► "Rechazar" (con motivo) ─► el dinero vuelve a estar disponible
          el jugador puede cancelar mientras esté en revisión ─► el dinero vuelve
```

## Reglas de seguridad (todas con pruebas contra Postgres real)

- **Acreditar es idempotente:** aprobar dos veces (o cinco a la vez) acredita **una** sola vez.
- **Un comprobante = una recarga:** el mismo número de operación no se puede usar en dos pedidos vivos
  (índice único en la base). Reusarlo genera una **alerta grave**. Un pedido rechazado libera su número.
- **Comprobante:** solo imágenes PNG/JPG/WEBP reconocidas por sus primeros bytes (no por lo que diga el
  navegador), máximo 2 MB. Se guarda en la base (tabla aparte) y solo lo ve un admin, servido con el tipo real
  y `nosniff`. **Contiene datos personales: tratarlo con cuidado y definir cuánto tiempo se conserva.**
- **Nadie se aprueba a sí mismo:** un admin no puede acreditar su propia recarga ni pagar su propio retiro.
- **Retiro sin fondos falso:** el dinero se aparta al pedirlo; no se puede gastar en salas mientras se revisa.
  No se puede retirar más de lo disponible (el dinero bloqueado en salas no cuenta).
- **Requisitos:** mayor de 18 (declarado) y Steam vinculado, para jugar en salas, recargar y retirar.
- **Interruptor:** `PAYMENTS_ENABLED`. En producción está **apagado por defecto**; hay que encenderlo a propósito.

## Límites (piloto: montos chicos)

En céntimos, configurables por variable de entorno (ver `.env.example`):

| | Mínimo | Máximo por operación | Máximo por día (24 h) | Pendientes a la vez |
|---|---|---|---|---|
| Recarga | S/ 5 | S/ 200 | S/ 500 | 3 |
| Retiro | S/ 10 | S/ 200 | S/ 500 | 2 |

El tope diario cuenta también lo pendiente y **no se salta pidiendo varias cosas a la vez** (los pedidos de un
mismo usuario se atienden en fila).

## Alertas de movimientos raros

Se ven en **Admin → Tesorería**.

- **Graves:** número de operación reusado; **el dinero no cuadra** (billeteras ≠ lo que entró − lo que salió);
  una billetera cuyo saldo no coincide con su libro de movimientos.
- **Para revisar** (pedidos pendientes con señales): monto cercano al máximo; muchos pedidos en una hora; varios
  rechazos recientes; retirar dinero que casi no jugó (menos de la mitad de lo que recargó); retirar poco después
  de recargar (< 24 h); un mismo destino de pago usado por otras cuentas.

Las señales **no bloquean solas**: avisan para que la revisión sea atenta.

## "¿Cuadra el dinero?"

La tesorería compara, en un mismo instante de la base:
`dinero en billeteras (jugadores + plataforma)` contra `recargas + ajustes − retiros pagados`.
Debe dar **diferencia 0**. Si no, hay una alerta grave. Los "ajustes / saldo de prueba" no son dinero real.

## Antes de usar dinero real (checklist)

1. **Abogado:** cobrar entradas y repartir premios puede ser apuesta o juego a distancia en Perú. Sin opinión legal, no.
2. **Valve:** ver `src/modules/rooms/README.md` (riesgo de perder el login de Steam de todo el sitio).
3. **Términos y privacidad** publicados; aviso claro de que se guardan comprobantes.
4. **Dos personas** con rol admin (para que nadie apruebe lo suyo) y cuentas de cobro/pago separadas de las personales.
5. **Backups** de la base de datos y prueba de restaurar.
6. Definir cuánto **tiempo** se guardan los comprobantes y cómo se borran.
7. Empezar con **conocidos y montos chicos**, revisando la tesorería todos los días.
8. `PAYMENTS_ENABLED=true`, y poner los datos de pago (`PAYMENTS_YAPE_NUMBER`, etc.).

## Lo que NO hace (todavía)

- No verifica identidad (la mayoría de edad es una declaración, no una prueba).
- No concilia solo con el banco: el admin es quien confirma que el dinero llegó.
- No hay pasarela de pago automática (Culqi, Niubiz…): es una mejora posible cuando el volumen lo justifique.
- Los abandonos en partida no tienen multa todavía (Sprint 6).
