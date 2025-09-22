FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm install

COPY . .

RUN npm run prisma:generate
RUN npm run build

EXPOSE 8080
CMD ["node", "dist/index.js"]
