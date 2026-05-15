FROM node:22-bookworm-slim AS build

RUN apt-get update -y && apt-get install -y \
  openssl \
  libreoffice \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/prisma ./prisma
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/vendor ./vendor

RUN npm run prisma:generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

RUN apt-get update -y && apt-get install -y \
  openssl \
  libreoffice \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
ENV NODE_ENV=production

COPY --from=build /app/backend/package.json /app/backend/package-lock.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/vendor ./vendor
COPY templates /app/templates

RUN mkdir -p /app/backend/uploads && chown -R node:node /app/backend /app/templates

USER node
EXPOSE 5001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
