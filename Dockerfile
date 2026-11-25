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
ENV PORT=3847
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server.ts ./server.ts
COPY tsconfig.json ./tsconfig.json
EXPOSE 3847
CMD ["npm", "start"]
