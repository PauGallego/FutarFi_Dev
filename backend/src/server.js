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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Connect to database
connectDB();

app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

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
