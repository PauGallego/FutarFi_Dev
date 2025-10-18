export const market_abi = [
    {
        "type": "function",
        "name": "buy",
        "inputs": [
            { "name": "optionIndex", "type": "bool", "internalType": "bool" },
            { "name": "amount", "type": "uint256", "internalType": "uint256" }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "closeMarket",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getMarketTypePrice",
        "inputs": [{ "name": "idx", "type": "uint8", "internalType": "uint8" }],
        "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "initialize",
        "inputs": [
            {
                "name": "_collateralToken",
                "type": "address",
                "internalType": "contract IERC20"
            },
            { "name": "_maxSupply", "type": "uint256", "internalType": "uint256" },
            {
                "name": "_pythAddress",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "_collateralPriceId",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "_marketTokenImpl",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "isOpen",
        "inputs": [],
        "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "maxSupply",
        "inputs": [],
        "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "openMarket",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "sell",
        "inputs": [
            { "name": "optionIndex", "type": "bool", "internalType": "bool" },
            { "name": "tokenAmount", "type": "uint256", "internalType": "uint256" }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "totalSupply",
        "inputs": [],
        "outputs": [
            { "name": "tot0", "type": "uint256", "internalType": "uint256" },
            { "name": "tot1", "type": "uint256", "internalType": "uint256" }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "userCollateral",
        "inputs": [
            { "name": "user", "type": "address", "internalType": "address" },
            { "name": "optionIndex", "type": "uint8", "internalType": "uint8" }
        ],
        "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
        "stateMutability": "view"
    }
] as const
