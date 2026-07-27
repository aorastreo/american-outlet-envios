FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
ARG CACHE_BUST=12
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["sh", "start.sh"]
