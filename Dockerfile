# One container serves the website (landing at /, workspace at /workspace.html)
# and the workspace API from the same origin. Configuration is environment only;
# see .env.example and docs/architecture/hosted-deployment.md.
FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/core/package.json packages/core/
# Dev dependencies stay: the server runs TypeScript through tsx.
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build:pages && chown -R node:node /app

USER node
ENV NODE_ENV=production \
    RENOVAGENT_HOST=0.0.0.0 \
    PORT=4000 \
    RENOVAGENT_STATIC_DIR=pages-dist
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]
