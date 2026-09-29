FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --force
COPY . .
RUN rm -rf dist && npm run build
EXPOSE 3000
CMD ["sh", "start.sh"]
