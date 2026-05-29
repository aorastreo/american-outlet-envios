FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set registry https://npm.mirrors.msh.team
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
