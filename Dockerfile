# =========================================================================
# SPACE-04: Multi-Satellite Downlink Autonomous Scheduling Dashboard
# Production Multi-Stage Dockerfile
# =========================================================================

# Stage 1: Build Application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Minimal Production Image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
COPY --from=builder /app/dist ./dist
COPY serve-dist.js ./

EXPOSE 8080
CMD ["node", "serve-dist.js"]
