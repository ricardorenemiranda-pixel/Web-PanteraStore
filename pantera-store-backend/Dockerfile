# --- Etapa 1: build ---------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- Etapa 2: runtime ---------------------------------------------------
# Imagen final sin devDependencies, sin código fuente TS, y corriendo con
# un usuario sin privilegios — lo mínimo necesario para producción.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN addgroup -S pantera && adduser -S pantera -G pantera
USER pantera

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/main"]
