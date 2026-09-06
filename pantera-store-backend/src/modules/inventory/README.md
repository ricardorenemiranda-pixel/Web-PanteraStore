# Inventory — implementado, sin cuenta de bot

Corrección importante sobre lo que decía este README antes: **no hace falta
una cuenta de bot de Steam para leer el inventario del usuario.** Eso solo
sería necesario para la fase futura de salas de Dota (bots que juegan
partidas, Game Coordinator). Para simplemente *mostrar* qué items tiene el
usuario, Steam expone un endpoint público:

```
GET https://steamcommunity.com/inventory/{steamId64}/570/2?l=english&count=5000
```

Devuelve el inventario completo (siempre que el perfil del usuario tenga el
inventario en modo público, que es el default de Steam) sin necesitar login
ni API key. Verificado en vivo con un SteamID real durante el desarrollo.

## Lo que hace hoy

- `infrastructure/steam/steam-inventory-http.gateway.ts` — llama a ese
  endpoint, cruza `assets` con `descriptions`, y mapea cada item a
  `{ assetId, marketHashName, name, hero, rarity, imageUrl, tradable, marketable }`.
  La rareza sale del tag `category: "Rarity"` de Steam (`Rarity_Mythical`,
  `Rarity_Legendary`, etc.) — coincide 1:1 con nuestro tipo `Rarity`.
- `application/use-cases/get-sellable-inventory.use-case.ts` — se queda
  solo con los items **tradeable** de rareza **Mítico/Legendario/Inmortal/Arcano**
  (mismo criterio que el filtro de "Rareza" del catálogo público), y le
  calcula el precio de recompra vigente a cada uno consultando Steam Market
  (mismo `SteamMarketGateway` que usa `catalog`) + el markup/descuento
  configurados.
- `GET /inventory/me` (protegido con `JwtAuthGuard`) — devuelve ese listado
  ya armado para el usuario logueado.

## Bug real que ya se encontró y arregló: rate limit de Steam Market

`GET /inventory/me` calcula el precio de recompra de cada item consultando
`SteamMarketHttpGateway.getLowestPrice()` (mismo gateway que usa `catalog`).
La primera versión pedía el precio de **todos** los items vendibles en
paralelo (`Promise.all`) — con un inventario real de 82 items vendibles,
Steam devolvía **HTTP 429 (Too Many Requests)** para casi todos, y el
frontend terminaba sin poder mostrar ni seleccionar ningún item (el botón
de seleccionar está deshabilitado si `buybackPrice` es `null`).

Verificado en vivo disparando 82 requests en paralelo: la gran mayoría volvió
429. Con 3 requests espaciados 3s sí funcionaron. Es un rate limit por
ráfaga, no un baneo largo — pero es agresivo.

**Fix aplicado** (ver `get-sellable-inventory.use-case.ts` y
`steam-market-http.gateway.ts`):
1. `mapWithConcurrency` (`src/shared/application/concurrency.ts`) — como
   mucho 2 requests a Steam Market en simultáneo en vez de todos de una.
2. Reintento automático con espera de 2.5s si Steam responde 429.
3. Caché en memoria de 5 minutos por `market_hash_name` en
   `SteamMarketHttpGateway` — compartida entre `catalog` e `inventory`, así
   que recargar la página o que otro usuario tenga el mismo item no vuelve
   a pegarle a Steam.

Con esto una carga en frío de ~80 items tarda unos segundos (no instantáneo,
pero ya no falla en bloque). Si en el futuro esto sigue sintiéndose lento,
el siguiente paso natural es Redis (persistente entre reinicios del server,
no solo en memoria) y/o cargar la lista de items primero y traer los
precios de forma progresiva en vez de bloquear toda la respuesta.

**Segunda vuelta del mismo bug**: el endpoint del **inventario en sí**
(`steamcommunity.com/inventory/...`, no el de precios) también puede
devolver 429 si se pegan varias recargas seguidas (típico en desarrollo,
reiniciando el server o refrescando la página muchas veces). La primera
versión no lo manejaba y explotaba con un 500 crudo. Ahora
`steam-inventory-http.gateway.ts` reintenta hasta 3 veces con 2.5s de
espera, y si sigue sin responder lanza `ExternalServiceUnavailableException`
→ el filtro global la traduce a **503**, y el frontend (`useSellableInventory`)
lo muestra como "Steam está limitando las peticiones, intenta de nuevo" con
un botón de reintentar, en vez de un error genérico o una pantalla rota.

**Nota sobre sesiones tras reiniciar el server**: como los usuarios viven en
memoria (`InMemoryUserRepository`), reiniciar el backend borra todos los
usuarios pero las cookies de sesión ya emitidas siguen siendo JWTs
"válidos" (mismo secreto) hasta que expiran. El resultado es un 403 en
`/auth/me` ("Usuario no encontrado") hasta que el usuario vuelve a
loguearse con Steam — el frontend ya lo trata igual que "no logueado", así
que no rompe nada, solo pide loguearse de nuevo. Esto desaparece solo en
cuanto haya Postgres conectado.

## Pendiente / mejoras futuras

1. **Redis** — reemplazar la caché en memoria por Redis (sobrevive reinicios
   del server, y se puede compartir entre réplicas si la API llega a escalar).
2. **Precio null** — si Steam Market no tiene referencia de precio para un
   item (item raro, poco volumen, o rate limit agotó los reintentos),
   `buybackPrice` sale `null` — el frontend ya lo maneja mostrando "No disponible"
   y bloqueando la selección de ese item.
3. Si el perfil del usuario tiene el inventario en privado, el endpoint
   devuelve vacío/403 — hay que mostrarle un mensaje claro pidiéndole que
   lo ponga en público (Steam → Perfil → Editar perfil → Privacidad de inventario).
4. Para la fase futura de salas de Dota, ahí sí va a hacer falta
   `node-steam-user`/`node-dota2` con una cuenta de bot dedicada — pero es
   un problema completamente aparte de este módulo.
