##
# Docker Build: docker build . -t dbe-backend
# Docker Run: docker run -p 3000:3000 dbe-backend
# Docker PS: docker ps | grep dbe-backend
# Docker Stop: docker stop IMAGE_ID
##

FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package.json ./

RUN npm i -f

# Bundle app source
COPY . .

EXPOSE 3000

CMD [ "node", "server.js" ]

