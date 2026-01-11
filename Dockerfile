FROM node:20-bullseye-slim AS builder
WORKDIR /build

# Cache package install
COPY package.json package-lock.json* ./
RUN npm ci --silent

# Copy source and build
COPY . .
RUN npm run build

# Runtime stage: minimal image to serve the compiled app
FROM node:20-alpine AS runtime
WORKDIR /app

# Install a tiny static server
RUN npm install -g serve --no-audit --no-fund --silent

# Copy ONLY the built artifacts
COPY --from=builder /build/dist ./dist
# Keep essential metadata
COPY --from=builder /build/LICENSE ./LICENSE
COPY --from=builder /build/package.json ./package.json

# Expose the app port
EXPOSE 3024

ENV NODE_ENV=production
# Serve the built app on port 3024
CMD ["serve", "-s", "dist", "-l", "3024"]

# BUILD:
# docker build -t gcclinux/easyeditor:1.6.0 .
# RUN:
# docker run --name EASYEDITOR --rm -p 3024:3024 gcclinux/easyeditor:1.6.0
# CONFIGURE:
# docker run -d --name EASYEDITOR --rm -p 3024:3024 gcclinux/easyeditor:1.6.0
