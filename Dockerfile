# Recouvrix — Node web service (Express + Vite build)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Writable SQLite dir on ephemeral container disk
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data /app/public

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY server.ts ./server.ts
COPY demoStore.ts ./demoStore.ts
COPY tsconfig.json ./tsconfig.json

# Render injects PORT at runtime; default for local Docker runs.
ENV PORT=3847
EXPOSE 3847
CMD ["npm", "start"]
