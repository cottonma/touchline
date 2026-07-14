#!/bin/bash
# =============================================================
# Touchline - One Command Start
# =============================================================
# Just run: ./start.sh
# Then open http://localhost:3001 in your browser
# =============================================================

echo ""
echo "⚽ Touchline - Digital Coaching Companion"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Download from https://nodejs.org"
    exit 1
fi
echo "  ✓ Node.js $(node -v)"

# Install dependencies if needed
if [ ! -d "server/node_modules" ]; then
    echo "  📦 Installing dependencies (first time only)..."
    npm install --silent 2>/dev/null
    cd server && npm install --silent 2>/dev/null && cd ..
    cd client && npm install --silent 2>/dev/null && cd ..
fi

# Build frontend if needed
if [ ! -d "client/dist" ]; then
    echo "  🔨 Building frontend..."
    cd client && npx vite build --silent 2>/dev/null && cd ..
fi

# Run migrations and seed
echo "  🔄 Checking database..."
cd server
npx tsx src/db/migrate.ts 2>&1 | grep -v "^📦" | grep -v "^$"
npx tsx src/db/seed-all.ts 2>&1 | grep -v "^📦" | grep -v "^$"
cd ..

echo ""
echo "==========================================================="
echo ""
echo "  ⚽ Touchline is running!"
echo ""
echo "  Open in your browser:  http://localhost:3001"
echo ""
echo "  Press Ctrl+C to stop."
echo ""
echo "==========================================================="
echo ""

# Start the server (serves both API and frontend)
cd server && npx tsx src/app.ts
