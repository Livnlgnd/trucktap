# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/trucktap.db
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/server/dist ./dist
COPY dist /app/dist
RUN mkdir -p /data
EXPOSE 8787
VOLUME ["/data"]
CMD ["node", "dist/index.js"]
