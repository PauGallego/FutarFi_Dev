require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

const connectDB = require('./config/database');
const proposalsRouter = require('./routes/proposals');
const orderbooksRouter = require('./routes/orderbooks');
const authRouter = require('./routes/auth');
const realtimeRouter = require('./routes/realtime');
const rateLimit = require('./middleware/rateLimit');
const { ethers } = require('ethers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Make io accessible to routes via req.app.get('io') as used in code
app.set('io', io);

const PORT = process.env.PORT || 3001;

// Connect to database
connectDB();

app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Client must authenticate once per connection with signed message
  socket.on('auth-wallet', ({ address, signature, message, timestamp }) => {
    try {
      if (!address || !signature || !message || !timestamp) {
        socket.emit('auth-error', { error: 'Missing auth fields' });
        return;
      }
      const expectedMessage = `FutarFi Authentication\nAddress: ${address}\nTimestamp: ${timestamp}`;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      if (message !== expectedMessage || now - parseInt(timestamp) > fiveMinutes) {
        socket.emit('auth-error', { error: 'Invalid message or expired timestamp' });
        return;
      }
      const recovered = ethers.verifyMessage(message, signature);
      if (recovered.toLowerCase() !== address.toLowerCase()) {
        socket.emit('auth-error', { error: 'Invalid signature' });
        return;
      }
      socket.data.address = address.toLowerCase();
      socket.join(`user-${socket.data.address}`);
      socket.emit('auth-success', { address: socket.data.address });
      console.log(`Socket ${socket.id} authenticated as ${socket.data.address}`);
    } catch (e) {
      socket.emit('auth-error', { error: 'Auth verification failed' });
    }
  });

  socket.on('join-proposal', (proposalId) => {
    socket.join(`proposal-${proposalId}`);
    console.log(`Socket ${socket.id} joined proposal room: ${proposalId}`);
  });

  socket.on('leave-proposal', (proposalId) => {
    socket.leave(`proposal-${proposalId}`);
    console.log(`Socket ${socket.id} left proposal room: ${proposalId}`);
  });

  socket.on('join-orderbook', (proposalId, side) => {
    socket.join(`orderbook-${proposalId}-${side}`);
    console.log(`Socket ${socket.id} joined orderbook room: ${proposalId}-${side}`);
  });

  socket.on('leave-orderbook', (proposalId, side) => {
    socket.leave(`orderbook-${proposalId}-${side}`);
    console.log(`Socket ${socket.id} left orderbook room: ${proposalId}-${side}`);
  });

  // Allow client to explicitly subscribe to their orders room after auth
  socket.on('subscribe-my-orders', () => {
    if (!socket.data.address) {
      socket.emit('auth-error', { error: 'Authenticate first with auth-wallet' });
      return;
    }
    socket.join(`user-${socket.data.address}`);
    socket.emit('subscribed-my-orders', { address: socket.data.address });
  });

  socket.on('unsubscribe-my-orders', () => {
    if (!socket.data.address) return;
    socket.leave(`user-${socket.data.address}`);
    socket.emit('unsubscribed-my-orders', { address: socket.data.address });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit);

app.use('/api/proposals', proposalsRouter);
app.use('/api/orderbooks', orderbooksRouter);
app.use('/api/auth', authRouter);
app.use('/api/realtime', realtimeRouter);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'FutarFi API Documentation'
}));

// Redirect root to API documentation
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current status of the API server
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthStatus'
 */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});

module.exports = { app, io };
