
Write-Host "[HTTPS] Setting up HTTPS for EasyEditor..."
Write-Host ""

# Find openssl
$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if ($null -eq $openssl) {
    if (Test-Path "C:\Program Files\Git\usr\bin\openssl.exe") {
        $openssl = "C:\Program Files\Git\usr\bin\openssl.exe"
    }
    elseif (Test-Path "C:\Program Files (x86)\Git\usr\bin\openssl.exe") {
        $openssl = "C:\Program Files (x86)\Git\usr\bin\openssl.exe"
    }
    else {
        Write-Host "Error: openssl is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Please install Git for Windows (which includes openssl) or OpenSSL for Windows."
        Write-Host "  - Download: https://git-scm.com/download/win"
        exit 1
    }
}

# Check if certificates already exist
if ((Test-Path "key.pem") -and (Test-Path "cert.pem")) {
    Write-Host "Warning: Certificates already exist!" -ForegroundColor Yellow
    $confirmation = Read-Host "Do you want to regenerate them? (y/N)"
    if ($confirmation -notmatch "^[Yy]$") {
        Write-Host "Keeping existing certificates."
        exit 0
    }
    Write-Host "Regenerating certificates..."
}

# Generate self-signed certificate
Write-Host "Generating self-signed certificate..."

# Run openssl
try {
    $process = Start-Process -FilePath $openssl -ArgumentList "req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj /C=US/ST=State/L=City/O=EasyEditor/CN=localhost" -Wait -NoNewWindow -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host ""
        Write-Host "[OK] Certificates generated successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Files created:"
        Write-Host "   - key.pem  (private key)"
        Write-Host "   - cert.pem (certificate)"
        Write-Host ""
        Write-Host "Next steps:"
        Write-Host "   1. Run: npm run server"
        Write-Host "   2. Access via: https://localhost:3024"
        Write-Host "   3. Accept the security warning in your browser"
        Write-Host ""
        Write-Host "From other devices on your network:"
        Write-Host "   - Find your IP: ipconfig"
        Write-Host "   - Access via: https://YOUR_IP:3024"
        Write-Host ""
        Write-Host "Note: You will see a security warning because this is a self-signed" -ForegroundColor Yellow
        Write-Host "certificate. This is normal for local development. Click Advanced" -ForegroundColor Yellow
        Write-Host "and Proceed (or Continue) to continue." -ForegroundColor Yellow
        Write-Host ""
    }
    else {
        throw "Exit code $($process.ExitCode)"
    }
}
catch {
    Write-Host ""
    Write-Host "Error: Failed to generate certificates" -ForegroundColor Red
    Write-Host "Please check that openssl is properly installed."
    exit 1
}
