# build-docker.ps1 - Build and push Docker image for EasyEditor on Windows
$ErrorActionPreference = "Stop"

# Get version from package.json
$VERSION = node -p "require('./package.json').version"

# Determine architecture
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "amd64" }

# Build Docker image WITHOUT secrets
Write-Host "Building Docker image: gcclinux/easyeditor:${VERSION}-${arch}" -ForegroundColor Cyan
docker build -t "gcclinux/easyeditor:${VERSION}-${arch}" .

Write-Host ""
Write-Host "Docker image built successfully: gcclinux/easyeditor:${VERSION}-${arch}" -ForegroundColor Green
Write-Host ""

# Login to Docker Hub
Write-Host "Now login to Docker Hub" -ForegroundColor Cyan
docker login

# Push to Docker Hub
Write-Host "Pushing Docker image to Docker Hub" -ForegroundColor Cyan
docker push "gcclinux/easyeditor:${VERSION}-${arch}"

Write-Host ""
Write-Host "To run with your secrets, use:" -ForegroundColor Yellow
Write-Host "docker run -d --name EASYEDITOR -p 3024:3024 --env-file .env.local gcclinux/easyeditor:${VERSION}-${arch}"
