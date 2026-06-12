FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile --filter @escape-nthu/server...

COPY server ./server
RUN pnpm --filter @escape-nthu/server build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile --prod --filter @escape-nthu/server...

COPY --from=build /app/server/dist ./server/dist

EXPOSE 8787
CMD ["pnpm", "--filter", "@escape-nthu/server", "start"]
