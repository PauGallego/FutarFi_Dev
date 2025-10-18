const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/database');
const contractLoader = require('./config/contractLoader');
// const priceRoutes = require('./routes/prices');
// const proposalRoutes = require('./routes/proposals');
const blockchainService = require('./services/blockchainService');

const app = express();
const PORT = process.env.PORT || 3001;

// Load contract addresses
contractLoader.loadAddresses();

// Connect to database
connectDB();

// Security middlewares
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Routes (temporarily disabled - debugging)
// app.use('/api/prices', priceRoutes);
// app.use('/api/proposals', proposalRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Simple proposals endpoint to check database
app.get('/api/proposals', async (req, res) => {
  try {
    const Proposal = require('./models/Proposal');
    const proposals = await Proposal.find({}).limit(10);
    res.json({
      count: proposals.length,
      proposals: proposals
    });
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Force refresh proposals from blockchain
app.post('/api/proposals/refresh', async (req, res) => {
  try {
    const blockchainService = require('./services/blockchainService');
    await blockchainService.importExistingProposals();
    
    const Proposal = require('./models/Proposal');
    const proposals = await Proposal.find({}).limit(10);
    
    res.json({
      message: 'Proposals refreshed successfully',
      count: proposals.length,
      proposals: proposals
    });
  } catch (error) {
    console.error('Error refreshing proposals:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  const contractAddresses = contractLoader.getAllAddresses();
  res.json({
    message: 'FutarFi Price History API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      prices: '/api/prices',
      proposals: '/api/proposals'
    },
    contracts: contractAddresses,
    blockchain: {
      rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
      chainId: process.env.CHAIN_ID || '31337'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  
  // Stop price monitoring
  priceMonitor.stop();
  
  // Stop blockchain service
  if (blockchainService.stop) {
    blockchainService.stop();
  }
  
  // Close database connection
  const mongoose = require('mongoose');
  await mongoose.connection.close();
  
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  
  // Validate contract addresses
  const isValid = contractLoader.validateAddresses();
  if (!isValid) {
    console.warn('⚠️ Some contract addresses are missing. Price monitoring may not work correctly.');
  }
  
  // Initialize blockchain service for event listening and price monitoring
  blockchainService.initialize()
    .then(() => {
      console.log('🔗 Blockchain service initialized');
      // Start monitoring new proposals and prices every 5 seconds
      blockchainService.startMonitoring();
    })
    .catch(error => {
      console.error('Failed to initialize blockchain service:', error);
    });
});

module.exports = app;
