FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --force
ARG CACHE_BUST=16
RUN echo "CACHE_BUST=16-force-rebuild"
COPY . .
RUN rm -rf dist
RUN cat src/pages/Track.tsx | grep -q "public-v1" && echo "Track.tsx has public-v1" || echo "WARNING: Track.tsx missing public-v1"
RUN npm run build
EXPOSE 3000
CMD ["sh", "start.sh"]
