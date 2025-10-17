export const proposalManager_abi = [

            {
                "type": "constructor",
                "inputs": [
                    {
                        "name": "_proposalImpl",
                        "type": "address",
                        "internalType": "address"
                    },
                    { "name": "_marketImpl", "type": "address", "internalType": "address" },
                    {
                        "name": "_marketTokenImpl",
                        "type": "address",
                        "internalType": "address"
                    }
                ],
                "stateMutability": "nonpayable"
            },
            {
                "type": "function",
                "name": "createProposal",
                "inputs": [
                    { "name": "_name", "type": "string", "internalType": "string" },
                    { "name": "_description", "type": "string", "internalType": "string" },
                    { "name": "_duration", "type": "uint256", "internalType": "uint256" },
                    {
                        "name": "_collateralToken",
                        "type": "address",
                        "internalType": "address"
                    },
                    { "name": "_maxSupply", "type": "uint256", "internalType": "uint256" },
                    { "name": "_target", "type": "address", "internalType": "address" },
                    { "name": "_data", "type": "bytes", "internalType": "bytes" }
                ],
                "outputs": [
                    { "name": "id", "type": "uint256", "internalType": "uint256" }
                ],
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
                    { "name": "", "type": "address[]", "internalType": "address[]" }
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
            },
            {
                "type": "function",
                "name": "marketImpl",
                "inputs": [],
                "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
                "stateMutability": "view"
            },
            {
                "type": "function",
                "name": "marketTokenImpl",
                "inputs": [],
                "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
                "stateMutability": "view"
            },
            {
                "type": "function",
                "name": "owner",
                "inputs": [],
                "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
                "stateMutability": "view"
            },
            {
                "type": "function",
                "name": "proposalCount",
                "inputs": [],
                "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
                "stateMutability": "view"
            },
            {
                "type": "function",
                "name": "proposalImpl",
                "inputs": [],
                "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
                "stateMutability": "view"
            },
            {
                "type": "function",
                "name": "renounceOwnership",
                "inputs": [],
                "outputs": [],
                "stateMutability": "nonpayable"
            },
            {
                "type": "function",
                "name": "setImplementations",
                "inputs": [
                    { "name": "_p", "type": "address", "internalType": "address" },
                    { "name": "_m", "type": "address", "internalType": "address" },
                    { "name": "_t", "type": "address", "internalType": "address" }
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
            },
            {
                "type": "function",
                "name": "transferOwnership",
                "inputs": [
                    { "name": "newOwner", "type": "address", "internalType": "address" }
                ],
                "outputs": [],
                "stateMutability": "nonpayable"
            },
            {
                "type": "event",
                "name": "OwnershipTransferred",
                "inputs": [
                    {
                        "name": "previousOwner",
                        "type": "address",
                        "indexed": true,
                        "internalType": "address"
                    },
                    {
                        "name": "newOwner",
                        "type": "address",
                        "indexed": true,
                        "internalType": "address"
                    }
                ],
                "anonymous": false
            },
            {
                "type": "event",
                "name": "ProposalExecuted",
                "inputs": [
                    {
                        "name": "proposalId",
                        "type": "uint256",
                        "indexed": true,
                        "internalType": "uint256"
                    }
                ],
                "anonymous": false
            },
            {
                "type": "event",
                "name": "ProposalRegistered",
                "inputs": [
                    {
                        "name": "proposalId",
                        "type": "uint256",
                        "indexed": true,
                        "internalType": "uint256"
                    },
                    {
                        "name": "proposal",
                        "type": "address",
                        "indexed": true,
                        "internalType": "address"
                    }
                ],
                "anonymous": false
            },
            {
                "type": "event",
                "name": "adminAdded",
                "inputs": [
                    {
                        "name": "proposalId",
                        "type": "uint256",
                        "indexed": true,
                        "internalType": "uint256"
                    },
                    {
                        "name": "admin",
                        "type": "address",
                        "indexed": true,
                        "internalType": "address"
                    }
                ],
                "anonymous": false
            },
            {
                "type": "event",
                "name": "adminRemoved",
                "inputs": [
                    {
                        "name": "proposalId",
                        "type": "uint256",
                        "indexed": true,
                        "internalType": "uint256"
                    },
                    {
                        "name": "admin",
                        "type": "address",
                        "indexed": true,
                        "internalType": "address"
                    }
                ],
                "anonymous": false
            },
            { "type": "error", "name": "FailedDeployment", "inputs": [] },
            {
                "type": "error",
                "name": "InsufficientBalance",
                "inputs": [
                    { "name": "balance", "type": "uint256", "internalType": "uint256" },
                    { "name": "needed", "type": "uint256", "internalType": "uint256" }
                ]
            },
            {
                "type": "error",
                "name": "OwnableInvalidOwner",
                "inputs": [
                    { "name": "owner", "type": "address", "internalType": "address" }
                ]
            },
            {
                "type": "error",
                "name": "OwnableUnauthorizedAccount",
                "inputs": [
                    { "name": "account", "type": "address", "internalType": "address" }
                ]
            }

] as const