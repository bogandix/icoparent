FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY workers/icoparent-worker/package.json workers/icoparent-worker/package.json
RUN pnpm install --frozen-lockfile
COPY . .
WORKDIR /app/workers/icoparent-worker
EXPOSE 8787
CMD ["pnpm", "exec", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "8787"]
