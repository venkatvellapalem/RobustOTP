# RobustOTP One-Command Installer & Test Suite
# Runs on Windows PowerShell (irm https://raw.githubusercontent.com/venkatvellapalem/RobustOTP/main/install.ps1 | iex)

Write-Host "==========================================" -ForegroundColor Indigo
Write-Host "   RobustOTP Installer & Verification Suite" -ForegroundColor Indigo
Write-Host "==========================================" -ForegroundColor Indigo

# 1. Check Node.js installation
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed on this machine. Please download it from https://nodejs.org/"
    exit 1
}

# 2. Check if we are inside the repository, or need to clone it
if (-not (Test-Path "package.json")) {
    Write-Host "[info] package.json not found in current path. Cloning repository..." -ForegroundColor Yellow
    if (Test-Path "RobustOTP") {
        Remove-Item -Recurse -Force "RobustOTP"
    }
    git clone https://github.com/venkatvellapalem/RobustOTP.git
    Set-Location "RobustOTP"
}

# 3. Install packages
Write-Host "[info] Installing dependencies..." -ForegroundColor Green
npm install

# 4. Configure environment
if (-not (Test-Path ".env")) {
    Write-Host "[info] Setting up local environment variables (.env)..." -ForegroundColor Green
    Copy-Item ".env.example" ".env"
}

# 5. Initialize database schema
Write-Host "[info] Initializing database schema with Prisma..." -ForegroundColor Green
npx prisma generate
npx prisma db push

# 6. Run automated verification test suite
Write-Host "[info] Starting test server and executing verification suite..." -ForegroundColor Green
$env:NODE_ENV="test"
$serverProcess = Start-Process node -ArgumentList "src/server.js" -PassThru -NoNewWindow -WindowStyle Hidden

# Wait a moment for server to bind
Start-Sleep -Seconds 3

try {
    node tests/test.js
}
finally {
    # Clean up the background server process
    Write-Host "[info] Cleaning up background test server..." -ForegroundColor Green
    Stop-Process -Id $serverProcess.Id -Force
}

Write-Host "==========================================" -ForegroundColor Indigo
Write-Host "   Setup Completed successfully!" -ForegroundColor Indigo
Write-Host "==========================================" -ForegroundColor Indigo
