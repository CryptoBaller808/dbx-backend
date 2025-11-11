##
# Docker Build: docker build . -t dbx-backend
# Docker Run: docker run -p 8080:8080 dbx-backend
# Docker PS: docker ps | grep dbx-backend
# Docker Stop: docker stop IMAGE_ID
##

FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
# Copy package files first for better caching
COPY package*.json ./
RUN npm ci --omit=dev

# Bundle app source
COPY . .

# Set production environment
ENV NODE_ENV=production

# Expose the port
EXPOSE 8080

# Health check for Railway
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the server
CMD ["node", "server.js"]
