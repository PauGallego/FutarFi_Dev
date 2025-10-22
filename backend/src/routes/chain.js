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
 *     summary: Get public signer address and chain id
 *     tags: [Chain]
 *     responses:
 *       200:
 *         description: Address and chain id
 */
router.get('/info', async (_req, res) => {
  try {
    const [address, chainId] = await Promise.all([
      getWalletAddress(),
      getChainId()
    ]);
    res.json({ address, chainId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
