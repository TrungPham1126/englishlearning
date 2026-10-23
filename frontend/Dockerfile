# ==============================================================================
# Multi-stage Dockerfile for React Vite Frontend (Production Nginx)
# ==============================================================================
# Stage 1: Build Application
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build with relative/proxy API endpoint
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Stage 2: Minimal Nginx Runtime
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# Clear default static files
RUN rm -rf ./*

# Copy built artifacts from builder stage
COPY --from=builder /app/dist .

# Copy Nginx server configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

