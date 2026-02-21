#!/usr/bin/env bash
set -e

VERSION=$(node -p "require('../package.json').version")

# Build Docker image WITHOUT secrets
docker build -t gcclinux/easyeditor:${VERSION}-$(arch) .

echo "✅ Docker image built successfully: gcclinux/easyeditor:${VERSION}-$(arch)"
echo ""
echo "Now login in Docker Hub"
docker login

echo "Pushing Docker image to Docker Hub"
docker push gcclinux/easyeditor:${VERSION}-$(arch)
echo ""
echo "To run with your secrets, use:"
echo "  docker run -d --name EASYEDITOR -p 3024:3024 --env-file .env.local gcclinux/easyeditor:${VERSION}-$(arch)"
