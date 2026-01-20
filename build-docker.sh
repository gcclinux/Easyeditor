#!/bin/bash
set -e

# Build Docker image WITHOUT secrets
docker build -t gcclinux/easyeditor:1.6.0-$(arch) .

echo "✅ Docker image built successfully: gcclinux/easyeditor:1.6.0-$(arch)"
echo ""
echo "To run with your secrets, use:"
echo "  docker run -d --name EASYEDITOR -p 3024:3024 --env-file .env.local gcclinux/easyeditor:1.6.0-$(arch)"
