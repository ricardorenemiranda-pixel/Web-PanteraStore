# Despliegue en Hostinger + Coolify

El VPS (Hostinger KVM 2, Ubuntu 24.04 + Coolify) despliega apps a partir de
un `Dockerfile` — ya está listo en la raíz de este proyecto.

## Cómo se despliega

1. En Coolify: **New Resource → Application → Dockerfile** (o "desde
   repositorio Git" si ya subiste esto a GitHub/GitLab — recomendado en
   cuanto tengas el repo, así Coolify redeploya solo en cada push).
2. Coolify detecta el `Dockerfile` de la raíz y lo construye igual que
   `docker build .` localmente (probalo antes con `docker compose up
   --build` para confirmar que levanta bien).
3. Variables de entorno: cargar las mismas de `.env.example` en la sección
   "Environment Variables" de Coolify — **nunca subir el `.env` real al
   repo** (ya está en `.gitignore`).
4. Health check: Coolify puede apuntar a `GET /health` (ya devuelve
   `{status: "ok"}`) para saber si el contenedor está sano antes de meterlo
   al tráfico durante un deploy.
5. Postgres y Redis: en Coolify convienen como "recursos" separados
   (Coolify los ofrece con un clic, con backups automáticos) en vez de dentro
   del mismo contenedor del backend — así se pueden reiniciar/actualizar
   independiente del código de la API. El `docker-compose.yml` de este repo
   es solo para probar localmente algo parecido, no es lo que corre en
   Coolify tal cual.

## Qué escala bien y qué NO (importante para no tener sorpresas)

**Toda la API tal como está hoy (`catalog`, `orders`, `auth`, `inventory`)
es stateless** — no guarda sesión en memoria, la identidad viaja en el JWT
(cookie httpOnly), y `inventory` solo hace un fetch HTTP al endpoint público
de Steam por request (no mantiene ninguna sesión propia). Eso significa que
en Coolify se pueden correr **N réplicas** del mismo contenedor detrás de su
proxy sin ningún cambio de código, si algún día hay más tráfico del que
aguanta una sola instancia.

**La fase futura de salas de Dota (bots jugando partidas, no implementada
todavía) NO va a escalar igual.** `node-steam-user`/`node-dota2` ahí sí
mantienen una sesión persistente y única por cuenta de bot — si se corren 2
réplicas del mismo bot, Steam desloguea una (o las dos se pisan). Cuando se
construya esa fase:
- Tiene que correr como **un servicio Coolify aparte, con réplicas = 1
  siempre**, no dentro del mismo contenedor que la API ni escalado junto
  con ella.
- La API le habla a ese servicio (o a Redis, si el bot publica ahí los
  datos) en vez de manejar la sesión de Steam directamente — así la API
  sigue pudiendo escalar sin arrastrar esta limitación.

(Esta limitación **no aplica** al `inventory` actual — leer el inventario
público de un usuario es un simple request HTTP sin estado, escala junto
con el resto de la API sin problema.)

## Otras cosas a tener en cuenta a futuro

- **Migraciones de base de datos**: cuando se conecte TypeORM (ver README
  principal, sección "Qué falta"), correr las migraciones como parte del
  deploy (un paso `npm run migration:run` antes de levantar la nueva
  versión), no con `synchronize: true` en producción — eso puede borrar
  datos reales por accidente.
- **Logs**: Nest ya loguea a stdout/stderr, que es justo lo que Coolify
  espera para mostrarlos en su panel — no hace falta configurar nada extra
  por ahora.
- **Secrets**: `JWT_SECRET` y `STEAM_API_KEY` reales (no los de
  `.env.example`) van solo en las variables de entorno de Coolify, nunca en
  código ni en el repo.
