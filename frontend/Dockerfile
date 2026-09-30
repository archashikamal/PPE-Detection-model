# Stage 1: Build React application
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build arguments for environment injection during static bundling
ARG VITE_API_BASE=""
ARG VITE_WS_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_WS_BASE=$VITE_WS_BASE

RUN npm run build

# Stage 2: Serve with lightweight Nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
