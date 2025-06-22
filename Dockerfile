##
# Docker Build: docker build . -t dbe-backend
# Docker Run: docker run -p 3000:8080 dbe-backend
# Docker PS: docker ps | grep dbe-backend
# Docker Stop: docker stop IMAGE_ID
##

FROM node:18-alpine

# Create app directory
WORKDIR /app

ENV PORT=8080

# Install app dependencies
COPY package.json ./

RUN npm i -f

# Bundle app source
COPY . .

EXPOSE 8080

CMD [ "node", "app.js" ]