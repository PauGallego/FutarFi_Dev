export const proposalManager_abi = [
     {
            "type": "constructor",
            "inputs": [
                {
                    "name": "_pyusd",
                    "type": "address",
                    "internalType": "address"
                }
            ],
            "stateMutability": "nonpayable"
        },
        {
            "type": "function",
            "name": "PYUSD",
            "inputs": [],
            "outputs": [
                {
                    "name": "",
                    "type": "address",
                    "internalType": "address"
                }
            ],
            "stateMutability": "view"
        },
        {
            "type": "function",
            "name": "allProposals",
            "inputs": [
                {
                    "name": "",
                    "type": "uint256",
                    "internalType": "uint256"
                }
            ],
            "outputs": [
                {
                    "name": "",
                    "type": "address",
                    "internalType": "address"
                }
            ],
            "stateMutability": "view"
        },
        {
            "type": "function",
            "name": "createProposal",
            "inputs": [
                {
                    "name": "_title",
                    "type": "string",
                    "internalType": "string"
                },
                {
                    "name": "_description",
                    "type": "string",
                    "internalType": "string"
                },
                {
                    "name": "_auctionDuration",
                    "type": "uint256",
                    "internalType": "uint256"
                },
                {
                    "name": "_liveDuration",
                    "type": "uint256",
                    "internalType": "uint256"
                },
                {
                    "name": "_subjectToken",
                    "type": "address",
                    "internalType": "address"
                },
                {
                    "name": "_minToOpen",
                    "type": "uint256",
                    "internalType": "uint256"
                },
                {
                    "name": "_maxCap",
                    "type": "uint256",
                    "internalType": "uint256"
                },
                {
                    "name": "_target",
                    "type": "address",
                    "internalType": "address"
                },
                {
                    "name": "_data",
                    "type": "bytes",
                    "internalType": "bytes"
                },
                {
                    "name": "_pythAddr",
                    "type": "address",
                    "internalType": "address"
                },
                {
                    "name": "_pythId",
                    "type": "bytes32",
                    "internalType": "bytes32"
                }
            ],
            "outputs": [
                {
                    "name": "id",
                    "type": "uint256",
                    "internalType": "uint256"
                }
            ],
            "stateMutability": "nonpayable"
        },
        {
            "type": "function",
            "name": "finalizeProposal",
            "inputs": [
                {
                    "name": "_proposalId",
                    "type": "uint256",
                    "internalType": "uint256"
                }
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
                    "name": "proposals_",
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
                {
                    "name": "_proposalId",
                    "type": "uint256",
                    "internalType": "uint256"
                }
            ],
            "outputs": [
                {
                    "name": "proposal",
                    "type": "address",
                    "internalType": "address"
                }
            ],
            "stateMutability": "view"
        },
        {
            "type": "function",
            "name": "getProposalsByAdmin",
            "inputs": [
                {
                    "name": "_admin",
                    "type": "address",
                    "internalType": "address"
                }
            ],
            "outputs": [
                {
                    "name": "",
                    "type": "address[]",
                    "internalType": "address[]"
                }
            ],
            "stateMutability": "view"
        },
        {
            "type": "function",
            "name": "nextId",
            "inputs": [],
            "outputs": [
                {
                    "name": "",
                    "type": "uint256",
                    "internalType": "uint256"
                }
            ],
            "stateMutability": "view"
        },
        {
            "type": "function",
            "name": "owner",
            "inputs": [],
            "outputs": [
                {
                    "name": "",
                    "type": "address",
                    "internalType": "address"
                }
            ],
            "stateMutability": "view"
        },
        {
            "type": "function",
            "name": "proposals",
            "inputs": [
                {
                    "name": "",
                    "type": "uint256",
                    "internalType": "uint256"
                }
            ],
            "outputs": [
                {
                    "name": "",
                    "type": "address",
                    "internalType": "address"
                }
            ],
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
            "name": "transferOwnership",
            "inputs": [
                {
                    "name": "newOwner",
                    "type": "address",
                    "internalType": "address"
                }
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
            "name": "ProposalCreated",
            "inputs": [
                {
                    "name": "id",
                    "type": "uint256",
                    "indexed": true,
                    "internalType": "uint256"
                },
                {
                    "name": "admin",
                    "type": "address",
                    "indexed": true,
                    "internalType": "address"
                },
                {
                    "name": "proposal",
                    "type": "address",
                    "indexed": false,
                    "internalType": "address"
                },
                {
                    "name": "title",
                    "type": "string",
                    "indexed": false,
                    "internalType": "string"
                }
            ],
            "anonymous": false
        },
        {
            "type": "error",
            "name": "OwnableInvalidOwner",
            "inputs": [
                {
                    "name": "owner",
                    "type": "address",
                    "internalType": "address"
                }
            ]
        },
        {
            "type": "error",
            "name": "OwnableUnauthorizedAccount",
            "inputs": [
                {
                    "name": "account",
                    "type": "address",
                    "internalType": "address"
                }
            ]
        }

] as const