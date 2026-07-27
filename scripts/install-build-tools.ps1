# Install Visual Studio Build Tools for Tauri development
Write-Host "Installing Visual Studio Build Tools..." -ForegroundColor Green

# Download VS Build Tools installer
$url = "https://aka.ms/vs/17/release/vs_buildtools.exe"
$output = "$env:TEMP\vs_buildtools.exe"

Write-Host "Downloading Visual Studio Build Tools..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $url -OutFile $output

Write-Host "Installing Build Tools with C++ workload..." -ForegroundColor Yellow
Write-Host "This may take several minutes..." -ForegroundColor Yellow

# Install with C++ build tools
Start-Process -FilePath $output -ArgumentList @(
    "--quiet",
    "--wait", 
    "--add", "Microsoft.VisualStudio.Workload.VCTools",
    "--includeRecommended"
) -Wait

Write-Host "Build Tools installation completed!" -ForegroundColor Green
Write-Host "You may need to restart your terminal/IDE for changes to take effect." -ForegroundColor Yellow

# Clean up
Remove-Item $output -Force