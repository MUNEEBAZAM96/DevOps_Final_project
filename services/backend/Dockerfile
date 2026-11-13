# ---- Stage 1: install production dependencies only ----
FROM node:24.22.3-alpine3.24 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---- Stage 2: the image that actually runs ----
FROM node:24.22.3-alpine3.24 AS runtime

# npm, npx, corepack and yarn are only needed to install packages, not to
# run the app. Removing them makes the image smaller and leaves fewer
# packages for Trivy to report.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*

ENV NODE_ENV=production
WORKDIR /app

# Files stay owned by root, so the app user can read them but not change them.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY certs ./certs

# Run as the unprivileged "node" user that the official image provides
# (user and group id 1000). A number is used so the host can always resolve it.
USER 1000:1000

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "src/server.js"]
