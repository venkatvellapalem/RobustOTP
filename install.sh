#!/bin/bash
# RobustOTP One-Command Installer & Test Suite
# Runs on Linux / macOS (curl -fsSL https://raw.githubusercontent.com/venkatvellapalem/RobustOTP/main/install.sh | bash)

set -e

echo -e "\033[1;34m==========================================\033[0m"
echo -e "\033[1;34m   RobustOTP Installer & Verification Suite\033[0m"
echo -e "\033[1;34m==========================================\033[0m"

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo -e ""
    echo -e "\033[1;31m[error] Node.js is not installed on your system.\033[0m"
    echo -e "\033[1;31m[error] Our product runs on Node.js and is built on that.\033[0m"
    echo -e ""
    echo -e "\033[1;33mYou can either:\033[0m"
    echo -e "\033[1;32m1. Download and install Node.js: https://nodejs.org/\033[0m"
    echo -e "\033[1;32m2. Test our deployed product online: https://robust-otp-cytrus.vercel.app/\033[0m"
    echo -e ""
    exit 1
fi

# 2. Check path or clone
if [ ! -f "package.json" ]; then
    rm -rf RobustOTP
    if command -v git &> /dev/null; then
        echo -e "\033[1;32m[info] Git found. Cloning repository...\033[0m"
        git clone https://github.com/venkatvellapalem/RobustOTP.git
        cd RobustOTP
    else
        echo -e "\033[1;33m[info] Git is not installed on your system. Falling back to archive mode...\033[0m"
        curl -L https://github.com/venkatvellapalem/RobustOTP/archive/refs/heads/main.zip -o RobustOTP-main.zip
        echo -e "\033[1;32m[info] Extracting project files...\033[0m"
        unzip -q RobustOTP-main.zip
        mv RobustOTP-main RobustOTP
        rm RobustOTP-main.zip
        cd RobustOTP
    fi
fi

# 3. Install packages
echo -e "\033[1;32m[info] Installing dependencies...\033[0m"
if ! npm install --ignore-scripts || [ ! -d "node_modules" ]; then
    echo -e ""
    echo -e "\033[1;31m[error] Dependency installation failed. Node.js or npm is not configured correctly on your system.\033[0m"
    echo -e "\033[1;31m[error] Our product runs on Node.js and requires package manager setup.\033[0m"
    echo -e ""
    echo -e "\033[1;33mYou can either:\033[0m"
    echo -e "\033[1;32m1. Repair/reinstall Node.js: https://nodejs.org/\033[0m"
    echo -e "\033[1;32m2. Test our deployed product online: https://robust-otp-cytrus.vercel.app/\033[0m"
    echo -e ""
    exit 1
fi

# 4. Setup env
if [ ! -f ".env" ]; then
    echo -e "\033[1;32m[info] Setting up local environment variables (.env)...\033[0m"
    cp .env.example .env
fi

# 5. Database setup
echo -e "\033[1;32m[info] Initializing local database schema with Prisma...\033[0m"
if ! npx prisma generate --schema=prisma/schema.local.prisma; then
    echo -e "\033[1;31m[error] Prisma Client generation failed.\033[0m"
    exit 1
fi
if ! npx prisma db push --schema=prisma/schema.local.prisma; then
    echo -e "\033[1;31m[error] Database schema push failed.\033[0m"
    exit 1
fi

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

echo -e "\n\033[1;32m[info] Launching local verification demo...\033[0m"
NODE_ENV=production node src/server.js > /dev/null 2>&1 &
sleep 2
if command -v xdg-open > /dev/null; then
    xdg-open "http://localhost:3000"
elif command -v open > /dev/null; then
    open "http://localhost:3000"
fi

exit $TEST_EXIT_CODE
