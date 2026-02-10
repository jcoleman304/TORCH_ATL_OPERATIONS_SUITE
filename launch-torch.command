#!/bin/bash

# TORCH ATL Operations Suite Launcher
# ====================================

echo "============================================"
echo "    TORCH ATL OPERATIONS SUITE"
echo "    Launching all systems..."
echo "============================================"
echo ""

# Set working directory
cd "$(dirname "$0")"

# Check if n8n is installed
if command -v n8n &> /dev/null; then
    echo "[1/4] Starting n8n workflow engine..."
    n8n start &
    N8N_PID=$!
    echo "      n8n started (PID: $N8N_PID)"
    sleep 3
else
    echo "[1/4] n8n not running (install with: npm install -g n8n)"
fi

# Start a local server for the Operations Suite
echo "[2/4] Starting local server on port 8080..."
if command -v python3 &> /dev/null; then
    python3 -m http.server 8080 &
    SERVER_PID=$!
    echo "      Server started (PID: $SERVER_PID)"
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8080 &
    SERVER_PID=$!
    echo "      Server started (PID: $SERVER_PID)"
else
    echo "      Python not found, opening file directly"
    SERVER_PID=""
fi

sleep 2

# Open the Operations Suite
echo "[3/4] Opening TORCH ATL Operations Suite..."
if [ -n "$SERVER_PID" ]; then
    open "http://localhost:8080"
else
    open "index.html"
fi

# Open n8n if running
if command -v n8n &> /dev/null; then
    echo "[4/4] Opening n8n workflow editor..."
    sleep 2
    open "http://localhost:5678"
fi

echo ""
echo "============================================"
echo "    TORCH ATL SYSTEMS ONLINE"
echo "============================================"
echo ""
echo "Operations Suite: http://localhost:8080"
echo "n8n Workflows:    http://localhost:5678"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep script running
wait
