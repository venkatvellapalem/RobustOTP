# RobustOTP One-Command Installer & Test Suite
# Runs on Windows PowerShell (irm https://raw.githubusercontent.com/venkatvellapalem/RobustOTP/main/install.ps1 | iex)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   RobustOTP Installer & Verification Suite" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Node.js installation
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "[error] Node.js is not installed on your system." -ForegroundColor Red
    Write-Host "[error] Our product runs on Node.js and is built on that." -ForegroundColor Red
    Write-Host ""
    Write-Host "You can either:" -ForegroundColor Yellow
    Write-Host "1. Download and install Node.js: https://nodejs.org/" -ForegroundColor Green
    Write-Host "2. Test our deployed product online: https://robust-otp-cytrus.vercel.app/" -ForegroundColor Green
    Write-Host ""
    return
}

# Set execution policy to Bypass for the current Process to resolve script execution blocks
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue

# 2. Check if we are inside the repository, or need to clone it
if (-not (Test-Path "package.json")) {
    if (Test-Path "RobustOTP") {
        Remove-Item -Recurse -Force "RobustOTP"
    }

    if (Get-Command git -ErrorAction SilentlyContinue) {
        Write-Host "[info] Git found. Cloning repository..." -ForegroundColor Green
        git clone https://github.com/venkatvellapalem/RobustOTP.git
        Set-Location "RobustOTP"
    } else {
        Write-Host "[info] Git is not installed on your system. Falling back to archive mode..." -ForegroundColor Yellow
        $zipUrl = "https://github.com/venkatvellapalem/RobustOTP/archive/refs/heads/main.zip"
        $zipPath = "$env:TEMP\RobustOTP-main.zip"
        
        # Download ZIP
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
        
        Write-Host "[info] Extracting project files..." -ForegroundColor Green
        Expand-Archive -Path $zipPath -DestinationPath "." -Force
        
        # Rename extracted folder to match project name
        Rename-Item "RobustOTP-main" "RobustOTP"
        Remove-Item $zipPath
        Set-Location "RobustOTP"
    }
}

# 3. Install packages
Write-Host "[info] Installing dependencies..." -ForegroundColor Green
npm install --ignore-scripts

# 4. Configure environment
if (-not (Test-Path ".env")) {
    Write-Host "[info] Setting up local environment variables (.env)..." -ForegroundColor Green
    Copy-Item ".env.example" ".env"
}

# Run SQLite transformation for local zero-dependency database
Write-Host "[info] Tuning database settings for local zero-config environment..." -ForegroundColor Green
node scripts/use-sqlite.js

# 5. Initialize database schema
Write-Host "[info] Initializing database schema with Prisma..." -ForegroundColor Green
npx prisma generate
npx prisma db push

# 6. Run automated verification test suite
Write-Host "[info] Starting test server and executing verification suite..." -ForegroundColor Green
$env:NODE_ENV="test"
$serverProcess = Start-Process node -ArgumentList "src/server.js" -PassThru -NoNewWindow

# Wait a moment for server to bind
Start-Sleep -Seconds 3

try {
    node tests/test.js
}
finally {
    # Clean up the background server process
    Write-Host "[info] Cleaning up background test server..." -ForegroundColor Green
    if ($serverProcess) {
        Stop-Process -Id $serverProcess.Id -Force
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Setup Completed successfully!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "[info] Launching local verification demo..." -ForegroundColor Green
$env:NODE_ENV="production"
Start-Process node -ArgumentList "src/server.js" -NoNewWindow
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"
