FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=apps/frontend"]
