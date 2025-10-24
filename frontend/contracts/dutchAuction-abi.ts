export const dutchAuction_abi = [
  {
    type: "function",
    name: "priceNow",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "buyLiquidity",
    inputs: [{ name: "_payAmount", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
