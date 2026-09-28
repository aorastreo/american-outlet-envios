FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --force
ARG CACHE_BUST=14
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["sh", "start.sh"]
