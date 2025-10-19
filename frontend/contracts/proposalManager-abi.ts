export const proposalManager_abi = [

    {
        "type": "function",
        "name": "createProposal",
        "inputs": [
            { "name": "_title", "type": "string", "internalType": "string" },
            { "name": "_description", "type": "string", "internalType": "string" },
            { "name": "_duration", "type": "uint256", "internalType": "uint256" },
            {
                "name": "_collateralToken",
                "type": "address",
                "internalType": "address"
            },
            { "name": "_maxSupply", "type": "uint256", "internalType": "uint256" },
            { "name": "_target", "type": "address", "internalType": "address" },
            { "name": "_data", "type": "bytes", "internalType": "bytes" },
            { "name": "_pythAddr", "type": "address", "internalType": "address" },
            { "name": "_pythId", "type": "bytes32", "internalType": "bytes32" }
        ],
        "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "finalizeProposal",
        "inputs": [
            { "name": "_proposalId", "type": "uint256", "internalType": "uint256" }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getAllProposals",
        "inputs": [],
        "outputs": [
            {
                "name": "proposals",
                "type": "address[]",
                "internalType": "address[]"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getProposalById",
        "inputs": [
            { "name": "_proposalId", "type": "uint256", "internalType": "uint256" }
        ],
        "outputs": [
            { "name": "proposal", "type": "address", "internalType": "address" }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "getProposalsByAdmin",
        "inputs": [
            { "name": "_admin", "type": "address", "internalType": "address" }
        ],
        "outputs": [
            { "name": "", "type": "address[]", "internalType": "address[]" }
        ],
        "stateMutability": "view"
    }
] as const