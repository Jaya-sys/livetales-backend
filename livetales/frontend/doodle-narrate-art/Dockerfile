FROM node:18-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Serve with lightweight static server
FROM node:18-slim

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

ENV PORT=8080

CMD ["serve", "dist", "-l", "8080", "-s"]
