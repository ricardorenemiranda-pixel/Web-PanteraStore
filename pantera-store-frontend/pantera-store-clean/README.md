# PanteraStore — Frontend

Frontend de PanteraStore construido en Next.js 14 + TypeScript + Tailwind CSS, a partir de las
pantallas diseñadas en Stitch. Todo el texto está en español y los precios en Soles (S/).

## Cómo correrlo

```bash
npm install
npm run dev
```

Luego abre http://localhost:3000

## Páginas incluidas

- `/` — Home con banner, categorías e items destacados
- `/catalogo` — Catálogo público con filtros por héroe, rareza y orden
- `/catalogo/[id]` — Detalle de un item con botón de contacto por WhatsApp
- `/login` — Pantalla de inicio de sesión con Steam (visual, falta conectar el backend)
- `/inventario` — Inventario del usuario logueado, con selección de items y total en vivo
- `/vender/resumen` — Resumen de venta: nombre, Steam Trade URL y botón que abre WhatsApp
  con el detalle de la orden
- `/admin` — Panel de administración: gestión de precios/markup por item y tabla de
  órdenes de venta pendientes

## Qué es real y qué es de ejemplo (mock)

- Los **items, precios e inventario del usuario** están en `lib/mock-data.ts` — son datos de
  ejemplo. Cuando el backend esté listo, esto se reemplaza por llamadas a la API real
  (sincronización con Steam Market + base de datos).
- Las **imágenes de items** están reemplazadas por bloques de placeholder
  (`components/ImagePlaceholder.tsx`) con un ícono y una etiqueta describiendo qué imagen
  debería ir ahí — no se usaron imágenes genéricas para que sea fácil identificar dónde
  colocar los renders reales de cada item.
- El **login con Steam** es solo visual — falta conectar la autenticación real (Steam OpenID)
  en el backend.
- El **número de WhatsApp** es un placeholder (`51900000000`) en `components/Footer.tsx`,
  `app/catalogo/[id]/page.tsx` y `app/vender/resumen/page.tsx` — hay que reemplazarlo por el
  número real de la empresa antes de publicar.

## Próximos pasos (backend)

1. Reemplazar `lib/mock-data.ts` por llamadas a una API real.
2. Conectar Steam OpenID para el login y traer el inventario real del usuario desde la API de Steam.
3. Conectar el worker que sincroniza precios desde el Steam Market y aplica el markup configurado
   en `/admin`.
4. Guardar las órdenes de venta generadas en `/vender/resumen` en una base de datos real
   (hoy solo se arma el mensaje de WhatsApp).
