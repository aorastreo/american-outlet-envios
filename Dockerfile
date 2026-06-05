FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
ARG CACHE_BUST=10
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["sh", "start.sh"]
