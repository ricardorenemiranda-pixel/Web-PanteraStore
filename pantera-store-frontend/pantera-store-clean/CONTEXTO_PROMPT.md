# Contexto para retomar el proyecto PanteraStore

## Qué es el proyecto
PanteraStore: marketplace de compra/venta de items de Dota 2 (Perú). Es mi primer proyecto freelance pagado. Repo en `C:\Users\User\Downloads\stitch_dota_2_item_marketplace`.

**Stack:**
- Frontend: Next.js (App Router) + TypeScript + Tailwind, en `pantera-store-frontend/pantera-store-clean`.
- Backend: NestJS con arquitectura hexagonal (domain/application/infrastructure/interface), en `pantera-store-backend`. Postgres + Redis vía Docker Compose.
- Catálogo 100% manual (el admin da de alta/edita/elimina cada item a mano, con precio sincronizado desde Steam Market + markup configurable por rareza o global).

## Qué ya existe funcionalmente (no rehacer la lógica, solo el diseño)
- Panel admin completo: catálogo manual, precios/markup (global + por rareza + por item), export a PDF, gestión de órdenes.
- Login solo por Steam OAuth (el rol admin depende de `ADMIN_STEAM_IDS` en `.env` del backend — el registro por correo nunca da admin).
- Catálogo público, página de detalle de item (con código de referencia para ubicarlo por WhatsApp), flujo de venta de inventario.
- Diálogos de confirmación propios (no el `confirm()` nativo del navegador).

## Restricciones técnicas (independientes del rediseño)
- **Nunca usar assets reales de Dota 2** (modelos 3D, texturas, íconos originales del juego) — son propiedad de Valve.
- Cuidado con el rendimiento: ya se optimizó (lazy loading de imágenes). No agregar cosas pesadas (WebGL, librerías grandes) sin justificarlo.
- No corras servidores de desarrollo en segundo plano — yo los corro en mis propias terminales (backend puerto 3001, frontend puerto 3000). Verifica contra los puertos que yo ya tenga levantados.
- Siempre verificar con `npx tsc --noEmit` después de cambios, y probar visualmente cuando se pueda.

## Qué quiero ahora
Acabo de instalar varios skills de diseño/animación (`impeccable`, `design-taste-frontend`, `high-end-visual-design`, `redesign-existing-projects`, `stitch-design-taste`, y los de Emil Kowalski: `animate`, `animation-vocabulary`, `emil-design-eng`, `find-animation-opportunities`, `improve-animations`, `review-animations`). Quiero que los uses para **reestructurar el diseño del sitio** — no estoy casado con la paleta de colores, tipografías ni el estilo visual que tiene ahora mismo. Aplica tu propio criterio de diseño (con esos skills) para proponer y construir algo mejor, manteniendo la funcionalidad de arriba intacta.
