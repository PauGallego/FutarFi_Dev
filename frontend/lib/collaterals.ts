import { getContractAddress } from "@/contracts/constants"

export type Collateral = {
  symbol: string
  address: `0x${string}`
  decimals: 6 | 18
  logoURI?: string
  note?: string
  // Oracle price feed identifier (Pyth price ID)
  pythID?: string
}

//  Map of supported collaterals per chainId.

export const SUPPORTED_COLLATERALS: Record<number, Collateral[]> = {
  // Hedera Testnet (296): 
  296: [
    { symbol: "AAVE", address: "0xa2aa501b19aff244d90cc15a4cf739d2725b5729", pythID: "2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445", decimals: 18, note: "Aave" },
    { symbol: "UNI", address: "0xa2aa501b19aff244d90cc15a4cf739d2725b5729", pythID: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", decimals: 18, note: "Uniswap" },
    { symbol: "BTC", address: "0xa2aa501b19aff244d90cc15a4cf739d2725b5729", pythID: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", decimals: 18, note: "Bitcoin" },
    { symbol: "ETH", address: "0xa2aa501b19aff244d90cc15a4cf739d2725b5729", pythID: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", decimals: 18, note: "Ethereum" },
    { symbol: "HBAR", address: "0xa2aa501b19aff244d90cc15a4cf739d2725b5729", pythID: "3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd", decimals: 18, note: "Hedera" },
  ],

  // Hedera Mainnet (295): 
  295: [
    { symbol: "AAVE", address: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", pythID: "2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445", decimals: 18, note: "Aave" },
    { symbol: "UNI", address: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", pythID: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", decimals: 18, note: "Uniswap" },
    { symbol: "BTC", address: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", pythID: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", decimals: 18, note: "Bitcoin" },
    { symbol: "ETH", address: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", pythID: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", decimals: 18, note: "Ethereum" },
    { symbol: "HBAR", address: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729", pythID: "3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd", decimals: 18, note: "Hedera" },
  ],

  // Ethereum Mainnet (1): real examples for USDC/DAI; set PYUSD accordingly
  1: [
    { symbol: "AAVE", address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", pythID: "2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445", decimals: 18, note: "Aave" },
    { symbol: "UNI", address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", pythID: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", decimals: 18, note: "Uniswap" },
    { symbol: "BTC", address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", pythID: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", decimals: 18, note: "Bitcoin" },
    { symbol: "ETH", address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", pythID: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", decimals: 18, note: "Ethereum" },
    { symbol: "HBAR", address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", pythID: "3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd", decimals: 18, note: "Hedera" },
  ],
  
  // Sepolia (11155111): dev mocks en testnet
  11155111: [
    { symbol: "AAVE", address: "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21", pythID: "2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445", decimals: 18, note: "Aave" },
    { symbol: "UNI", address: "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21", pythID: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", decimals: 18, note: "Uniswap" },
    { symbol: "BTC", address: "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21", pythID: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", decimals: 18, note: "Bitcoin" },
    { symbol: "ETH", address: "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21", pythID: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", decimals: 18, note: "Ethereum" },
    { symbol: "HBAR", address: "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21", pythID: "3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd", decimals: 18, note: "Hedera" },
  ],

  // Local Anvil (31337): dev-only mock
  31337: [
    { symbol: "AAVE", address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", pythID: "2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445", decimals: 18, note: "Aave" },
    { symbol: "UNI", address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", pythID: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", decimals: 18, note: "Uniswap" },
    { symbol: "BTC", address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", pythID: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", decimals: 18, note: "Bitcoin" },
    { symbol: "ETH", address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", pythID: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", decimals: 18, note: "Ethereum" },
    { symbol: "HBAR", address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6", pythID: "3728e591097635310e6341af53db8b7ee42da9b3a8d918f9463ce9cca886dfbd", decimals: 18, note: "Hedera" },
  ],
}

// Helper to get supported collaterals by chain, safely. 
export function getSupportedCollaterals(chainId?: number): Collateral[] {
  if (!chainId) return []
  return SUPPORTED_COLLATERALS[chainId] ?? []
}


