#!/bin/bash

echo "Setting up FutarFi API with Docker..."

# Create .env file for Docker
cat > .env << EOF
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://admin:password123@mongodb:27017/futarfi?authSource=admin
EOF

# Install dependencies
pnpm install

# Clean up and start
docker-compose down -v 2>/dev/null
docker-compose up -d --build

echo "Docker setup complete!"
echo "API: http://localhost:3001"
