# Futarchy-DeFi-Protocol
Futarchy-powered DeFi governance: PYUSD payments, Pyth Pull oracles, executed on Hedera.


## Introduction

FutarFi is a prediction market platform built on the Hedera EVM-compatible network, inspired by the principles of futarchy. It enables decentralized markets that allow participants to predict the outcome of specific decisions or performance metrics.

The system combines smart contracts, price oracles (Pyth), an initial Dutch auction for liquidity seeding, and an order book mechanism for continuous trading. It uses derivative tokens to gather collective intelligence through market mechanisms.


## Problem and Solution

### The Problem
Traditional DAO and DeFi governance frameworks rely heavily on voting mechanisms that do not always represent the most informed or economically efficient decision. Votes can be influenced by social bias, poor coordination, or lack of technical understanding, resulting in decisions that don’t maximize long-term protocol value.

### The Solution
FutarFi introduces **futarchy-based decision-making**, where predictions rather than votes guide choices. Through **prediction markets**, participants financially support the decision they believe will yield the most beneficial outcome. Market prices thus become real-time signals of collective confidence.

This approach:
``
* Aligns incentives toward truth-seeking and measurable performance.
* Filters out uninformed or emotional decision-making.
* Creates an objective and economically driven governance mechanism.

FutarFi achieves this by combining an initial liquidity auction, an open order book, verifiable price feeds from Pyth for initialization, and secure settlement via smart contracts.

---

## System Flow
![System Flow](https://github.com/user-attachments/assets/22721499-0fdf-4c89-bddd-fa4eb14acbb8)


## Design Decisions

* **Hedera EVM:** Selected for low latency, predictable gas fees, and full Ethereum tooling compatibility (Foundry, Viem, Wagmi).
* **Pyth:** Used exclusively to fetch the **initial price** of the subject token at market creation. Continuous update models are not implemented.
* **Dutch Auction for Liquidity:** Ensures fair and balanced initial market capitalization.
* **Order Book Trading:** Allows ongoing market-driven price discovery post-auction.
* **Market Tokens as Rewards:** Winners receive OPTIONS tokens bought with the treasury; losers can claim proportional treasury.
* **TEE Integration:** The final resolution endpoint executes within a **Trusted Execution Environment (TEE)** to guarantee tamper-proof validation and privacy-preserving computation.

---




1. **Proposal Creation**

   * When a new proposal is created, the market deployer defines:

     * **Subject Token:** the asset or variable being evaluated.
     * **Minimum Supply:** the minimum total amount of liquidity required for the market to initialize.
     * **Maximum Cap:** the total cap of liquidity allowed in the market.
     * **Optional Call Data and Target Contract:** an optional payload and target contract to be executed if the market result validates the proposed decision.
   * The initial reference price of the subject token is fetched from **Pyth**, ensuring an objective baseline.

2. **Initial Dutch Auction (Liquidity Seeding)**

   * A short Dutch auction is conducted solely to bootstrap **initial liquidity**.
   * Participants purchase **YES** or **NO** positions at a price that decreases linearly over time.
   * This ensures balanced liquidity distribution before transitioning into open trading.

3. **Order Book Trading Phase**

   * After the liquidity phase, the market switches to an **order book** model.
   * Traders can place limit or market orders for **YES/NO tokens**.
   * This mechanism allows continuous and transparent price discovery.

4. **Resolution Phase**

   * Upon reaching the resolution date or condition, the **subject token’s** price is compared against its initial reference value.
   * The outcome determines whether the **YES** or **NO** side wins.
   * The **winning side receives OPTIONS tokens**, which are **purchased from the treasury using the treasury of the winning token and distributed to holders of the winning token**.

5. **Claim and Settlement**

   * The **winning side** is allocated OPTIONS tokens bought with the treasury and delivered to holders of the winning token.
   * The **losing side** can **claim a proportional share of the treasury**, ensuring liquidity fairness and equitable capital distribution.

---

## Contracts flow
![System Flow](https://github.com/user-attachments/assets/738b7a25-923b-4f21-bfc8-13e9ac591e9f)

## Technical Architecture

```text
frontend (Next.js + Wagmi + Viem)
│
├── interacts with → smart contracts (Hedera EVM)
│       ├── MarketFactory.sol     → creates proposals and markets with params (minSupply, maxCap, callData)
│       ├── Market.sol            → handles liquidity auction, order book logic, resolution, and claims
│       └── MarketToken.sol       → issues market-specific YES/NO tokens
│
└── backend (API / indexing layer)
        └── indexes markets and interacts with the TEE endpoint for secure resolution
```

### Frontend/Backend Interaction

* The **frontend** uses **Viem** for contract interaction, managing auctions, orders, and claims.
* The **backend** indexes market state, aggregates data, and relays verified results from the TEE resolution endpoint.
* The **TEE** ensures off-chain comparison logic runs securely before triggering on-chain settlements.

---

## Technical Highlights

* **Proposal Parameters:** Each market defines min supply, cap, and optional executable logic.
* **Market-Specific Tokens:** Each market mints unique YES/NO tokens tied to that instance.
* **TEE Settlement:** The final resolution logic executes in a verifiable, confidential environment.
* **Economic Security:** The system isolates risks and rewards per market, maintaining predictability.
* **EVM Compatibility:** Deployable on Hedera RPC endpoints with standard Ethereum tooling.

---

## Local Setup

```bash
# Install dependencies
npm install

# Run frontend
npm run dev

# Deploy contracts with Foundry
forge script scripts/Deploy.s.sol --rpc-url $HEDERA_RPC --broadcast
```

---

FutarFi is an experimental futarchy-driven prediction market designed to enable transparent, economically rational, and verifiable decision-making in decentralized systems.

---

## Notes & Disclaimer

* **Monorepo:** The project is organized as a monorepo containing frontend, backend/indexer, and smart contract packages for unified development and CI workflows.
* **Docker-compatible:** The development environment and deployment scripts are Docker-compatible. Use the provided `docker-compose.yml` to run the stack locally.
* **Not audited / Not production-ready:** This codebase has **not been audited** and is **not ready for production deployment**. Use only for prototyping and development purposes.
* **Event:** Built for **ETHGlobal 2025**.

Please treat this repository as a proof-of-concept. Security reviews, audits, and additional hardening are required before any real-value deployment.
