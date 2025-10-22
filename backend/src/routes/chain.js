const express = require('express');
const router = express.Router();
const { getWalletAddress, getChainId } = require('../config/ethers');

/**
 * @swagger
 * tags:
 *   name: Chain
 *   description: EVM chain info (read-only)
 */

/**
 * @swagger
 * /api/chain/info:
 *   get:
 *     summary: Get public signer address, chain id, and ProposalManager address
 *     tags: [Chain]
 *     responses:
 *       200:
 *         description: Address, chain id, and ProposalManager
 */
router.get('/info', async (_req, res) => {
  try {
    const [address, chainId] = await Promise.all([
      getWalletAddress(),
      getChainId()
    ]);
    const proposalManagerAddress = process.env.PROPOSAL_MANAGER_ADDRESS || null;
    res.json({ address, chainId, proposalManagerAddress });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
