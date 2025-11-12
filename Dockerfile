FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Verify bin/www.js exists
RUN test -f bin/www.js || (echo "ERROR: bin/www.js not found!" && exit 1)

EXPOSE 3000

# --- DIAG: prove files baked into image ---
RUN echo "=== bin/www.js (first 20) ===" && head -20 bin/www.js || true
RUN echo "=== app.js (first 20) ===" && head -20 app.js || true
RUN echo "=== package.json scripts ===" && cat package.json | sed -n '1,120p' || true

ENTRYPOINT ["dumb-init","--"]
CMD ["node","bin/www.js"]
