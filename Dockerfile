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

ENTRYPOINT ["dumb-init","--"]
CMD ["node","bin/www.js"]
