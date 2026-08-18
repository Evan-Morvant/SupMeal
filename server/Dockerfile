# --- Étape de build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Étape d'exécution ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY openapi.yaml ./
# Scripts d'exploitation, dont le peuplement joué par le service `seed`.
COPY scripts ./scripts
EXPOSE 4000
CMD ["node", "dist/index.js"]
