import deployedAddresses from './deployed-addresses.json'

export const CONTRACTS = {
  // Local Anvil chain (chain ID: 31337)
  31337: {
    PROPOSAL_MANAGER: deployedAddresses[31337]?.PROPOSAL_MANAGER as `0x${string}` || "0x0000000000000000000000000000000000000000" as const,
    PROPOSAL_IMPL: deployedAddresses[31337]?.PROPOSAL_IMPL as `0x${string}` || "0x0000000000000000000000000000000000000000" as const,
    MARKET_IMPL: deployedAddresses[31337]?.MARKET_IMPL as `0x${string}` || "0x0000000000000000000000000000000000000000" as const,
    MARKET_TOKEN_IMPL: deployedAddresses[31337]?.MARKET_TOKEN_IMPL as `0x${string}` || "0x0000000000000000000000000000000000000000" as const,
  },
} as const;

export const getContractAddress = (chainId: number | undefined, contractName: keyof typeof CONTRACTS[31337]) => {
  if (!chainId || !CONTRACTS[chainId as keyof typeof CONTRACTS]) {
    return undefined;
  }
  return CONTRACTS[chainId as keyof typeof CONTRACTS][contractName];
};
