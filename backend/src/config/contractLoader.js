const fs = require('fs');
const path = require('path');

class ContractLoader {
  constructor() {
    this.addresses = {};
    this.chainId = process.env.CHAIN_ID || '31337';
  }

  loadAddresses() {
    try {
      // Simple path - the file should be copied to contracts/ during setup
      const addressesPath = path.join(process.cwd(), 'contracts/deployed-addresses.json');
      
      if (fs.existsSync(addressesPath)) {
        const addressesFile = fs.readFileSync(addressesPath, 'utf8');
        const allAddresses = JSON.parse(addressesFile);
        
        this.addresses = allAddresses[this.chainId] || {};
        
        console.log(`📋 Loaded contract addresses from: ${addressesPath}`);
        console.log(`📋 Addresses for chain ${this.chainId}:`, this.addresses);
        
        // Set environment variables if not already set
        if (this.addresses.PROPOSAL_MANAGER && !process.env.PROPOSAL_MANAGER_ADDRESS) {
          process.env.PROPOSAL_MANAGER_ADDRESS = this.addresses.PROPOSAL_MANAGER;
        }
        if (this.addresses.MARKET_IMPL && !process.env.MARKET_IMPL_ADDRESS) {
          process.env.MARKET_IMPL_ADDRESS = this.addresses.MARKET_IMPL;
        }
        if (this.addresses.MARKET_TOKEN_IMPL && !process.env.MARKET_TOKEN_IMPL_ADDRESS) {
          process.env.MARKET_TOKEN_IMPL_ADDRESS = this.addresses.MARKET_TOKEN_IMPL;
        }
        if (this.addresses.PROPOSAL_IMPL && !process.env.PROPOSAL_IMPL_ADDRESS) {
          process.env.PROPOSAL_IMPL_ADDRESS = this.addresses.PROPOSAL_IMPL;
        }
        
        return this.addresses;
      } else {
        console.warn('⚠️ deployed-addresses.json not found at:', addressesPath);
        console.warn('⚠️ Please run the setup script or ensure contract addresses are set via environment variables.');
        return {};
      }
    } catch (error) {
      console.error('Error loading contract addresses:', error);
      return {};
    }
  }

  getAddress(contractName) {
    return this.addresses[contractName] || process.env[`${contractName}_ADDRESS`];
  }

  getProposalManagerAddress() {
    return this.getAddress('PROPOSAL_MANAGER') || process.env.PROPOSAL_MANAGER_ADDRESS;
  }

  getMarketImplAddress() {
    return this.getAddress('MARKET_IMPL') || process.env.MARKET_IMPL_ADDRESS;
  }

  getMarketTokenImplAddress() {
    return this.getAddress('MARKET_TOKEN_IMPL') || process.env.MARKET_TOKEN_IMPL_ADDRESS;
  }

  getProposalImplAddress() {
    return this.getAddress('PROPOSAL_IMPL') || process.env.PROPOSAL_IMPL_ADDRESS;
  }

  getAllAddresses() {
    return {
      proposalManager: this.getProposalManagerAddress(),
      marketImpl: this.getMarketImplAddress(),
      marketTokenImpl: this.getMarketTokenImplAddress(),
      proposalImpl: this.getProposalImplAddress(),
      chainId: this.chainId
    };
  }

  validateAddresses() {
    const addresses = this.getAllAddresses();
    const missing = [];

    if (!addresses.proposalManager) missing.push('PROPOSAL_MANAGER');
    if (!addresses.marketImpl) missing.push('MARKET_IMPL');
    if (!addresses.marketTokenImpl) missing.push('MARKET_TOKEN_IMPL');
    if (!addresses.proposalImpl) missing.push('PROPOSAL_IMPL');

    if (missing.length > 0) {
      console.warn(`⚠️ Missing contract addresses: ${missing.join(', ')}`);
      console.warn('Please ensure these are set in deployed-addresses.json or environment variables.');
      return false;
    }

    console.log('✅ All contract addresses loaded successfully');
    return true;
  }
}

module.exports = new ContractLoader();
