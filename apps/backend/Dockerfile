FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev", "--workspace=apps/backend"]
