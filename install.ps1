# RobustOTP One-Command Installer & Test Suite
# Runs on Windows PowerShell (irm https://raw.githubusercontent.com/venkatvellapalem/RobustOTP/main/install.ps1 | iex)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   RobustOTP Installer & Verification Suite" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

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

# Check if DATABASE_URL is configured
$envContent = Get-Content ".env" -Raw
if ($envContent -match "DATABASE_URL=\s*`r?`n" -or $envContent -notmatch "DATABASE_URL=") {
    Write-Host ""
    Write-Host "[warning] DATABASE_URL is empty in your .env file." -ForegroundColor Yellow
    Write-Host "[warning] Please open '.env' and set your PostgreSQL database connection URL." -ForegroundColor Yellow
    Write-Host "[warning] Skipping database setup and automated verification tests for now." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "   Setup paused — Waiting for database configuration" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    exit 0
}

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
