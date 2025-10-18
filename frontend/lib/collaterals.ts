import { getContractAddress } from "@/contracts/constants"

export type Collateral = {
  symbol: string
  address: `0x${string}`
  decimals: 6 | 18
  logoURI?: string
  supportsPermit?: boolean
  note?: string
}

//  Map of supported collaterals per chainId.

export const SUPPORTED_COLLATERALS: Record<number, Collateral[]> = {
  // Hedera Testnet (296): dev mocks
  296: [
    { symbol: "MOCK6",  address: "0x1111111111111111111111111111111111111111", decimals: 6,  note: "Mock USDC (6d)" },
    { symbol: "MOCK18", address: "0x2222222222222222222222222222222222222222", decimals: 18, note: "Mock DAI (18d)" },
  ],

  // Hedera Mainnet (295): example (fill with HTS EVM alias)
  295: [
    { symbol: "USDC", address: "0x3333333333333333333333333333333333333333", decimals: 6, note: "USDC (HTS EVM alias)" },
    // Add DAI/PYUSD only if you want to allow their bridged/native versions on Hedera mainnet
  ],

  // Ethereum Mainnet (1): real examples for USDC/DAI; set PYUSD accordingly
  1: [
    { symbol: "USDC",  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6,  logoURI: "/tokens/usdc.svg" },
    { symbol: "DAI",   address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, logoURI: "/tokens/dai.svg", supportsPermit: true },
    { symbol: "PYUSD", address: "0x0000000000000000000000000000000000000001", decimals: 6,  logoURI: "/tokens/pyusd.svg", supportsPermit: true }, // TODO: set real
  ],
  
  // Sepolia (11155111): dev mocks en testnet
  11155111: [
    { symbol: "MOCK6",  address: "0x7777777777777777777777777777777777777777", decimals: 6,  note: "Mock USDC (6d) on Sepolia" },
    { symbol: "MOCK18", address: "0x8888888888888888888888888888888888888888", decimals: 18, note: "Mock DAI (18d) on Sepolia" },
  ],

  // Local Anvil (31337): dev-only mock
  31337: [
    { symbol: "MarketTest", address: getContractAddress(31337, 'MARKET_TOKEN_IMPL') || "0x0000000000000000000000000000000000000000", decimals: 18, note: "Local mock token (18d)" },
  ],
}

// Helper to get supported collaterals by chain, safely. 
export function getSupportedCollaterals(chainId?: number): Collateral[] {
  if (!chainId) return []
  return SUPPORTED_COLLATERALS[chainId] ?? []
}

//  Optional helper to find one collateral by address (case-insensitive). 
export function findCollateralByAddress(
  chainId: number | undefined,
  addr: string | undefined
): Collateral | undefined {
  if (!chainId || !addr) return undefined
  const list = SUPPORTED_COLLATERALS[chainId] ?? []
  const lower = addr.toLowerCase()
  return list.find((c) => c.address.toLowerCase() === lower)
}
