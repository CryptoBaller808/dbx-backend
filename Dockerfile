##
# Docker Build: docker build . -t dbe-backend
# Docker Run: docker run -p 3000:3000 dbe-backend
# Docker PS: docker ps | grep dbe-backend
# Docker Stop: docker stop IMAGE_ID
##

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node","server.js"]

