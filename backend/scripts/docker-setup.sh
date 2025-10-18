#!/bin/bash

# FutarFi Backend Setup Script

echo "Setting up FutarFi Backend..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker not installed"
    exit 1
fi

# Stop existing containers
echo "Stopping existing containers..."
if docker compose version &> /dev/null 2>&1; then
    docker compose down --remove-orphans > /dev/null 2>&1
else
    docker-compose down --remove-orphans > /dev/null 2>&1
fi

# Create contracts directory
mkdir -p contracts

# Copy contracts from frontend
if [ -f "../frontend/contracts/deployed-addresses.json" ]; then
    echo "Loading contract addresses..."
    cp "../frontend/contracts/deployed-addresses.json" "./contracts/"
else
    echo "No contracts found, creating empty file..."
    echo '{"31337": {}}' > "./contracts/deployed-addresses.json"
fi

# Build and start
echo "Building and starting services..."
if docker compose version &> /dev/null 2>&1; then
    docker compose build --no-cache > /dev/null
    docker compose up -d > /dev/null
else
    docker-compose build --no-cache > /dev/null
    docker-compose up -d > /dev/null
fi

# Wait and test
sleep 15
for i in {1..5}; do
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        echo "Backend deployed successfully"
        echo "API: http://localhost:3001"
        echo "Health: http://localhost:3001/health"
        exit 0
    fi
    sleep 3
done

echo "Error: Backend failed to start"
exit 1
