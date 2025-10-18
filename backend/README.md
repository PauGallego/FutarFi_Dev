# FutarFi - Backend

Simple backend to automatically detect and monitor proposals.

## What it does

- Detects new proposals automatically every 5 seconds
- Updates prices automatically every 5 seconds  
- Saves everything to database for the frontend
- Simple API to consume from frontend

## Setup (One command only)

```bash
npm run setup
```

That's it! Backend will be running on http://localhost:3001

## Main endpoints

- **GET /api/proposals** - See all detected proposals
- **GET /health** - Check if it's working

## How it works

1. **Connects** automatically to Anvil (localhost:8545)
2. **Searches for new proposals** every 5 seconds
3. **Updates prices** every 5 seconds
4. **Saves changes** to MongoDB automatically

## Quick test

```bash
# Check it works
curl http://localhost:3001/health

# See detected proposals
curl http://localhost:3001/api/proposals
```

## Create new proposal

1. Create your proposal from frontend
2. In maximum 5 seconds it will appear automatically in `/api/proposals`
3. Prices will update automatically every 5 seconds

That's it!

## Services

- **Backend**: http://localhost:3001
- **MongoDB**: localhost:27017

## Troubleshooting

If something doesn't work:

```bash
# See backend logs
docker-compose logs backend

# Restart services
docker-compose restart

# Check status
curl http://localhost:3001/health
```

## Stop backend

To stop the backend completely:

```bash
docker-compose down
```
