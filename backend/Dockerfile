FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npm run prisma:generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

USER node
EXPOSE 5001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
