const { ethers } = require('ethers');
const cron = require('node-cron');
const Proposal = require('../models/Proposal');
const PriceHistory = require('../models/PriceHistory');
const contractLoader = require('../config/contractLoader');

class PriceMonitor {
  constructor() {
    this.provider = null;
    this.contracts = new Map();
    this.isRunning = false;
    this.cronJob = null;
    this.eventListeners = new Map();
  }

  async initialize() {
    try {
      // Initialize provider
      const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      console.log('🔗 Connected to blockchain:', rpcUrl);
      
      // Load existing proposals and start monitoring
      await this.loadActiveProposals();
      
    } catch (error) {
      console.error('Failed to initialize price monitor:', error);
      throw error;
    }
  }

  async loadActiveProposals() {
    try {
      const activeProposals = await Proposal.findActive();
      console.log(`📊 Found ${activeProposals.length} active proposals to monitor`);
      
      for (const proposal of activeProposals) {
        await this.addProposalMonitoring(proposal);
      }
    } catch (error) {
      console.error('Error loading active proposals:', error);
    }
  }

  async addProposalMonitoring(proposal) {
    try {
      // Create contract instance for the market
      const marketContract = new ethers.Contract(
        proposal.marketAddress,
        this.getMarketABI(),
        this.provider
      );
      
      this.contracts.set(proposal.proposalId, {
        proposal,
        marketContract
      });
      
      // Set up event listeners for this market
      await this.setupEventListeners(proposal.proposalId, marketContract);
      
      console.log(`📈 Monitoring proposal ${proposal.proposalId}: ${proposal.name}`);
    } catch (error) {
      console.error(`Error setting up monitoring for proposal ${proposal.proposalId}:`, error);
    }
  }

  async setupEventListeners(proposalId, marketContract) {
    try {
      // Listen for Buy events
      marketContract.on('Bought', async (user, optionIndex, collateralIn, newPrice, event) => {
        await this.handleTradeEvent(proposalId, 'buy', {
          user,
          optionIndex,
          collateralIn,
          newPrice,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        });
      });

      // Listen for Sell events
      marketContract.on('Sold', async (user, optionIndex, tokenAmount, collateralOut, newPrice, event) => {
        await this.handleTradeEvent(proposalId, 'sell', {
          user,
          optionIndex,
          tokenAmount,
          collateralOut,
          newPrice,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        });
      });

      this.eventListeners.set(proposalId, marketContract);
      
    } catch (error) {
      console.error(`Error setting up event listeners for proposal ${proposalId}:`, error);
    }
  }

  async handleTradeEvent(proposalId, eventType, eventData) {
    try {
      const { optionIndex, newPrice, blockNumber, transactionHash, user } = eventData;
      const marketType = optionIndex === 0 ? 'approve' : 'reject';
      
      // Get additional market data
      const contractData = this.contracts.get(proposalId);
      if (!contractData) return;
      
      const { marketContract } = contractData;
      
      // Get current market state
      const [totalSupply, totalCollateral] = await Promise.all([
        marketContract.totalSupply(),
        marketContract.totalCollateralSupply()
      ]);
      
      const supply = optionIndex === 0 ? totalSupply[0] : totalSupply[1];
      const collateral = optionIndex === 0 ? totalCollateral[0] : totalCollateral[1];
      
      // Calculate volume based on event type
      let volume = '0';
      if (eventType === 'buy') {
        volume = eventData.collateralIn?.toString() || '0';
      } else if (eventType === 'sell') {
        volume = eventData.collateralOut?.toString() || '0';
      }
      
      // Save price history
      const priceEntry = new PriceHistory({
        proposalId,
        marketType,
        price: newPrice.toString(),
        volume,
        totalCollateral: collateral.toString(),
        totalSupply: supply.toString(),
        blockNumber,
        transactionHash,
        eventType,
        eventData: {
          user: user.toLowerCase(),
          amount: eventData.collateralIn?.toString() || eventData.collateralOut?.toString() || '0',
          tokensTraded: eventData.tokenAmount?.toString() || '0'
        }
      });
      
      await priceEntry.save();
      
      // Update proposal's current prices
      const proposal = await Proposal.findOne({ proposalId });
      if (proposal) {
        if (marketType === 'approve') {
          proposal.currentPrices.approve = newPrice.toString();
        } else {
          proposal.currentPrices.reject = newPrice.toString();
        }
        await proposal.save();
      }
      
      console.log(`💰 ${eventType.toUpperCase()} event recorded for proposal ${proposalId} (${marketType}): ${ethers.formatEther(newPrice)} ETH`);
      
    } catch (error) {
      console.error('Error handling trade event:', error);
    }
  }

  async periodicPriceUpdate() {
    try {
      const activeProposals = Array.from(this.contracts.values());
      
      for (const { proposal, marketContract } of activeProposals) {
        try {
          // Check if proposal is still active
          const isOpen = await marketContract.isOpen();
          if (!isOpen) {
            console.log(`📊 Proposal ${proposal.proposalId} is no longer open, removing from monitoring`);
            await this.removeProposalMonitoring(proposal.proposalId);
            continue;
          }
          
          // Get current prices for both markets
          const [approvePrice, rejectPrice] = await Promise.all([
            marketContract.getMarketTypePrice(0),
            marketContract.getMarketTypePrice(1)
          ]);
          
          const [totalSupply, totalCollateral] = await Promise.all([
            marketContract.totalSupply(),
            marketContract.totalCollateralSupply()
          ]);
          
          // Save current state for both markets
          const timestamp = new Date();
          const blockNumber = await this.provider.getBlockNumber();
          
          // Approve market
          await new PriceHistory({
            proposalId: proposal.proposalId,
            marketType: 'approve',
            price: approvePrice.toString(),
            volume: '0', // No volume for periodic updates
            totalCollateral: totalCollateral[0].toString(),
            totalSupply: totalSupply[0].toString(),
            timestamp,
            blockNumber,
            eventType: 'periodic_update'
          }).save();
          
          // Reject market
          await new PriceHistory({
            proposalId: proposal.proposalId,
            marketType: 'reject',
            price: rejectPrice.toString(),
            volume: '0', // No volume for periodic updates
            totalCollateral: totalCollateral[1].toString(),
            totalSupply: totalSupply[1].toString(),
            timestamp,
            blockNumber,
            eventType: 'periodic_update'
          }).save();
          
          // Update proposal's current prices
          await Proposal.findOneAndUpdate(
            { proposalId: proposal.proposalId },
            {
              'currentPrices.approve': approvePrice.toString(),
              'currentPrices.reject': rejectPrice.toString()
            }
          );
          
        } catch (error) {
          console.error(`Error updating prices for proposal ${proposal.proposalId}:`, error);
        }
      }
      
    } catch (error) {
      console.error('Error in periodic price update:', error);
    }
  }

  async removeProposalMonitoring(proposalId) {
    try {
      // Remove event listeners
      const contract = this.eventListeners.get(proposalId);
      if (contract) {
        contract.removeAllListeners();
        this.eventListeners.delete(proposalId);
      }
      
      // Remove from contracts map
      this.contracts.delete(proposalId);
      
      // Mark proposal as inactive
      await Proposal.findOneAndUpdate(
        { proposalId },
        { isActive: false }
      );
      
      console.log(`🔇 Stopped monitoring proposal ${proposalId}`);
    } catch (error) {
      console.error(`Error removing monitoring for proposal ${proposalId}:`, error);
    }
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Price monitor is already running');
      return;
    }

    this.initialize().then(() => {
      // Set up periodic price updates every 30 seconds
      const interval = process.env.PRICE_POLLING_INTERVAL || 30000;
      this.cronJob = cron.schedule(`*/${Math.floor(interval/1000)} * * * * *`, () => {
        this.periodicPriceUpdate();
      });

      this.isRunning = true;
      console.log('🚀 Price monitor started');
    }).catch(error => {
      console.error('Failed to start price monitor:', error);
    });
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Price monitor is not running');
      return;
    }

    // Stop cron job
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }

    // Remove all event listeners
    for (const contract of this.eventListeners.values()) {
      contract.removeAllListeners();
    }
    this.eventListeners.clear();

    // Clear contracts
    this.contracts.clear();

    this.isRunning = false;
    console.log('🛑 Price monitor stopped');
  }

  // Add a new proposal to monitoring
  async addProposal(proposalData) {
    try {
      // Create proposal in database
      const proposal = new Proposal(proposalData);
      await proposal.save();
      
      // Add to monitoring if active
      if (proposal.isActive && new Date() < proposal.endTime) {
        await this.addProposalMonitoring(proposal);
      }
      
      return proposal;
    } catch (error) {
      console.error('Error adding new proposal:', error);
      throw error;
    }
  }

  getMarketABI() {
    // Basic ABI for the Market contract events and functions we need
    return [
      "event Bought(address indexed user, uint8 indexed optionIndex, uint256 collateralIn, uint256 newPrice)",
      "event Sold(address indexed user, uint8 indexed optionIndex, uint256 tokenAmount, uint256 collateralOut, uint256 newPrice)",
      "function getMarketTypePrice(uint8 idx) external view returns (uint256)",
      "function totalSupply() external view returns (uint256 tot0, uint256 tot1)",
      "function totalCollateralSupply() external view returns (uint256 tot0, uint256 tot1)",
      "function isOpen() external view returns (bool)"
    ];
  }

  // Get monitoring status
  getStatus() {
    return {
      isRunning: this.isRunning,
      monitoredProposals: this.contracts.size,
      providerConnected: this.provider !== null,
      proposals: Array.from(this.contracts.keys())
    };
  }
}

// Create singleton instance
const priceMonitor = new PriceMonitor();

module.exports = priceMonitor;
