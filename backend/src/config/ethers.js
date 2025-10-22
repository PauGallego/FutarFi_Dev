require('dotenv').config();
const { ethers } = require('ethers');

// Simple ethers provider/signer wiring using env vars.
// Required env:
// - RPC_URL: JSON-RPC endpoint
// - PRIVATE_KEY: signer private key (used only for writes)
// - CHAIN_ID: optional chain id (number)

let provider;
let signer; // Optional, only if PRIVATE_KEY is set

function getProvider() {
  if (!provider) {
    if (!process.env.RPC_URL) {
      throw new Error('RPC_URL not set');
    }
    provider = new ethers.JsonRpcProvider(
      process.env.RPC_URL,
      process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : undefined
    );
  }
  return provider;
}

function getSigner() {
  if (signer) return signer;
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    // No signer configured; only read calls will be possible
    return null;
  }
  const prov = getProvider();
  signer = new ethers.Wallet(pk, prov);
  return signer;
}

async function getWalletAddress() {
  const s = getSigner();
  if (!s) return null;
  return await s.getAddress();
}

async function getChainId() {
  if (process.env.CHAIN_ID) return Number(process.env.CHAIN_ID);
  const net = await getProvider().getNetwork();
  // ethers v6 may return bigint for chainId
  const id = net?.chainId;
  return typeof id === 'bigint' ? Number(id) : Number(id || 0);
}

module.exports = {
  getProvider,
  getSigner,
  getWalletAddress,
  getChainId
};
