FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --force
COPY . .
# Don't build here - let start.sh handle it to bypass Railway build cache issues
EXPOSE 3000
CMD ["sh", "start.sh"]
