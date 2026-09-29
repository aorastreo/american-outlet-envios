FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --force
COPY . .
RUN cat src/pages/Track.tsx | grep -c "isSameBodega" || echo "ERROR: Track.tsx not updated"
RUN rm -rf dist && npm run build
EXPOSE 3000
CMD ["sh", "start.sh"]
