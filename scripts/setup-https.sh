#!/bin/bash

# Setup HTTPS for local development
# This creates a self-signed certificate for EasyEditor

echo "🔐 Setting up HTTPS for EasyEditor..."
echo ""

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    echo "❌ Error: openssl is not installed"
    echo "Please install openssl first:"
    echo "  - Ubuntu/Debian: sudo apt-get install openssl"
    echo "  - macOS: brew install openssl"
    echo "  - Windows: Download from https://slproweb.com/products/Win32OpenSSL.html"
    exit 1
fi

# Check if certificates already exist
if [ -f "key.pem" ] && [ -f "cert.pem" ]; then
    echo "⚠️  Certificates already exist!"
    read -p "Do you want to regenerate them? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing certificates."
        exit 0
    fi
    echo "Regenerating certificates..."
fi

# Generate self-signed certificate
echo "Generating self-signed certificate..."
openssl req -x509 -newkey rsa:4096 \
    -keyout key.pem \
    -out cert.pem \
    -days 365 \
    -nodes \
    -subj "/C=US/ST=State/L=City/O=EasyEditor/CN=localhost" \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Certificates generated successfully!"
    echo ""
    echo "📁 Files created:"
    echo "   - key.pem  (private key)"
    echo "   - cert.pem (certificate)"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Run: npm run server"
    echo "   2. Access via: https://localhost:3024"
    echo "   3. Accept the security warning in your browser"
    echo ""
    echo "📱 From other devices on your network:"
    echo "   - Find your IP: ip addr show (Linux) or ipconfig (Windows)"
    echo "   - Access via: https://YOUR_IP:3024"
    echo ""
    echo "⚠️  Note: You'll see a security warning because this is a self-signed"
    echo "   certificate. This is normal for local development. Click 'Advanced'"
    echo "   and 'Proceed' to continue."
    echo ""
else
    echo ""
    echo "❌ Error: Failed to generate certificates"
    echo "Please check that openssl is properly installed."
    exit 1
fi
