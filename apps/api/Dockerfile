FROM node:22-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @orchestrator/shared build && pnpm --filter @orchestrator/api build
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
