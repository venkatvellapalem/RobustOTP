#!/bin/bash
# RobustOTP One-Command Installer & Test Suite
# Runs on Linux / macOS (curl -fsSL https://raw.githubusercontent.com/venkatvellapalem/RobustOTP/main/install.sh | bash)

set -e

echo -e "\033[1;34m==========================================\033[0m"
echo -e "\033[1;34m   RobustOTP Installer & Verification Suite\033[0m"
echo -e "\033[1;34m==========================================\033[0m"

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "\033[1;31m[error] Node.js is not installed on this machine. Please install it first.\033[0m"
    exit 1
fi

# 2. Check path or clone
if [ ! -f "package.json" ]; then
    echo -e "\033[1;33m[info] package.json not found in current path. Cloning repository...\033[0m"
    rm -rf RobustOTP
    git clone https://github.com/venkatvellapalem/RobustOTP.git
    cd RobustOTP
fi

# 3. Install packages
echo -e "\033[1;32m[info] Installing dependencies...\033[0m"
npm install

# 4. Setup env
if [ ! -f ".env" ]; then
    echo -e "\033[1;32m[info] Setting up local environment variables (.env)...\033[0m"
    cp .env.example .env
fi

# Check if DATABASE_URL is configured
if grep -q "DATABASE_URL=[[:space:]]*$" .env || ! grep -q "DATABASE_URL=" .env; then
    echo -e "\n\033[1;33m[warning] DATABASE_URL is empty in your .env file.\033[0m"
    echo -e "\033[1;33m[warning] Please open '.env' and set your PostgreSQL database connection URL.\033[0m"
    echo -e "\033[1;33m[warning] Skipping database setup and automated verification tests for now.\033[0m"
    echo -e "\n\033[1;34m==========================================\033[0m"
    echo -e "\033[1;34m   Setup paused — Waiting for database configuration\033[0m"
    echo -e "\033[1;34m==========================================\033[0m"
    exit 0
fi

# 5. Database setup
echo -e "\033[1;32m[info] Initializing database schema with Prisma...\033[0m"
npx prisma generate
npx prisma db push

# 6. Start test server
echo -e "\033[1;32m[info] Starting test server and executing verification suite...\033[0m"
NODE_ENV=test node src/server.js > /dev/null 2>&1 &
SERVER_PID=$!

# Wait a moment for server to bind
sleep 3

# Run tests
set +e
node tests/test.js
TEST_EXIT_CODE=$?
set -e

# Clean up
echo -e "\033[1;32m[info] Cleaning up background test server...\033[0m"
kill $SERVER_PID || true

echo -e "\033[1;34m==========================================\033[0m"
echo -e "\033[1;34m   Setup Completed successfully!\033[0m"
echo -e "\033[1;34m==========================================\033[0m"

exit $TEST_EXIT_CODE
