FROM node:18-alpine

WORKDIR /app

# If package-lock.json exists, npm ci is ideal; otherwise fall back to npm install.
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY . .

ENV NODE_ENV=production
# Railway supplies PORT at runtime; we don't EXPOSE/HEALTHCHECK here.

CMD ["node", "server.js"]
