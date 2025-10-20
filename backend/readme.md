# FutarFi DeFi Protocol API

## Overview
Backend API for the FutarFi DeFi Protocol with real-time WebSocket support, limit/market orders, and comprehensive market data.

## Features

### WebSocket Real-time Updates
- Real-time order book updates
- Live order status changes
- Instant order matching notifications
- Market data streaming
- Proposal updates

### Market Orders Support
- Limit Orders: Traditional orders with specific price
- Market Orders: Execute immediately at best available price
- Order matching engine for market orders
- Partial fills support

### Enhanced Market Data
- 24h volume tracking
- Price change calculations
- Market depth analysis
- Candlestick/OHLCV data
- Trade history
- Spread calculations

### Real-time Dashboard
- Live system statistics
- Active proposals monitoring
- Recent trades feed
- Market overview

## API Endpoints

### Orderbooks
```
GET /api/orderbooks/:proposalId/:side - Get order book
GET /api/orderbooks/:proposalId - Get both order books
POST /api/orderbooks/:proposalId/:side/orders - Create order (limit/market)
GET /api/orderbooks/:proposalId/:side/orders - Get all orders
GET /api/orderbooks/:proposalId/:side/orders/filled - Get only filled orders
GET /api/orderbooks/:proposalId/:side/orders/open - Get open + partial orders
GET /api/orderbooks/:proposalId/:side/orders/partial - Get only partial orders
GET /api/orderbooks/:proposalId/:side/orders/status/:status - Get orders by status
GET /api/orderbooks/:proposalId/:side/orders/summary/:userAddress - Get user order summary
DELETE /api/orderbooks/orders/:orderId - Cancel order
GET /api/orderbooks/orders/:orderId/executions - Get order execution history
```

### Market Data
```
GET /api/orderbooks/:proposalId/:side/market-data - Market statistics (includes TWAP)
GET /api/orderbooks/:proposalId/:side/trades - Recent trades
GET /api/orderbooks/:proposalId/:side/depth - Order book depth
GET /api/orderbooks/:proposalId/:side/candles - Price history/candlesticks
GET /api/orderbooks/:proposalId/:side/twap - TWAP data only
```

### Proposals
```
GET /api/proposals - Get all proposals
POST /api/proposals - Create proposal
GET /api/proposals/:id - Get proposal by ID
GET /api/proposals/:id/stats - Proposal statistics
GET /api/proposals/with-market-data - Proposals with market data
```

### Real-time Data
```
GET /api/realtime/dashboard - Real-time dashboard data
GET /api/realtime/health - System health metrics
GET /api/realtime/market-overview - Market overview
GET /api/realtime/websocket-info - WebSocket connection info
```

## Order Types

### Limit Orders
```json
{
  "orderType": "buy|sell",
  "orderExecution": "limit",
  "price": "1.5",
  "amount": "100",
  "userAddress": "0x..."
}
```

### Market Orders
```json
{
  "orderType": "buy|sell",
  "orderExecution": "market",
  "amount": "100",
  "userAddress": "0x..."
}
```

## WebSocket Usage

Connect to WebSocket server:
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3001');
```

Join rooms:
```javascript
socket.emit('join-proposal', 'proposal-id');
socket.emit('join-orderbook', 'proposal-id', 'approve');
```

Listen to events:
```javascript
socket.on('new-order', (data) => console.log('New order:', data.order));
socket.on('orderbook-update', (data) => console.log('Orderbook updated:', data.orderBook));
socket.on('order-matched', (data) => console.log('Orders matched:', data));
socket.on('market-data', (data) => console.log('Market data:', data));
```

## Setup

### Docker
```bash
./setup.sh    # Initial setup with Docker
./stop.sh     # Stop Docker services
```


## Database Schema

### Proposal Model
```javascript
{
  id: Number,
  admin: String,
  title: String,
  description: String,
  startTime: Number,
  endTime: Number,
  duration: Number,
  collateralToken: String,
  maxSupply: String,
  target: String,
  data: String,
  marketAddress: String,
  proposalExecuted: Boolean,
  proposalEnded: Boolean,
  isActive: Boolean,
  // Virtual fields
  approveToken: String, // Generated from marketAddress
  rejectToken: String,  // Generated from marketAddress
  createdAt: Date,
  updatedAt: Date
}
```

### Order Model
```javascript
{
  proposalId: String,
  side: 'approve' | 'reject',
  orderType: 'buy' | 'sell',
  orderExecution: 'limit' | 'market',
  price: String, // Required for limit orders
  amount: String,
  filledAmount: String,
  slippage: String, // Optional, for information only
  executedPrice: String, // Average weighted execution price
  fills: [{ // Order execution history
    price: String,
    amount: String,
    timestamp: Date,
    matchedOrderId: String
  }],
  userAddress: String,
  status: 'open' | 'filled' | 'cancelled' | 'partial',
  txHash: String,
  createdAt: Date,
  updatedAt: Date
}
```

### OrderBook Model
```javascript
{
  proposalId: String,
  side: 'approve' | 'reject',
  bids: [OrderBookEntry],
  asks: [OrderBookEntry],
  lastPrice: String,
  volume24h: String,
  high24h: String,
  low24h: String,
  priceChange24h: String,
  priceChangePercent24h: String,
  twap1h: String,
  twap4h: String,
  twap24h: String,
  twapLastUpdate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### OrderBookEntry Schema
```javascript
{
  price: String,
  amount: String,
  orderCount: Number
}
```

### PriceHistory Model
```javascript
{
  proposalId: String,
  side: 'approve' | 'reject',
  price: String,
  volume: String,
  timestamp: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### TWAP Model
```javascript
{
  proposalId: String,
  side: 'approve' | 'reject',
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '24h',
  twapPrice: String,
  volume: String,
  timestamp: Date,
  pricePoints: [{
    price: String,
    amount: String,
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## Features

- Indexed database queries for fast retrieval
- Aggregation pipelines for market data
- Rate limiting for API protection
- WebSocket real-time notifications
- Order matching engine
- Comprehensive market data analytics

## Testing

```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/realtime/dashboard
curl -X POST http://localhost:3001/api/orderbooks/proposal-1/approve/orders \
  -H "Content-Type: application/json" \
  -d '{"orderType": "buy", "orderExecution": "market", "amount": "100", "userAddress": "0x123"}'
```

## Dependencies

- socket.io: WebSocket support
- express: Web framework
- mongoose: MongoDB ODM
- joi: Validation
- cors: Cross-origin requests
- helmet: Security headers
