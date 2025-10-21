// WebSocket notification helpers

const notifyOrderBookUpdate = (io, proposalId, side, orderBook) => {
  // Public orderbook broadcasts disabled intentionally
  return;
};

const notifyNewOrder = (io, order) => {
  // Public new-order broadcasts disabled intentionally
  return;
};

const notifyOrderStatusChange = (io, order, oldStatus) => {
  // Public order status broadcasts disabled intentionally
  return;
};

const notifyOrderMatched = (io, buyOrder, sellOrder, matchedAmount, matchedPrice) => {
  // Public match broadcasts disabled intentionally
  return;
};

const notifyProposalUpdate = (io, proposal) => {
  // Keep proposal updates (no orderbook data included)
  io.to(`proposal-${proposal.id}`).emit('proposal-update', {
    proposal,
    timestamp: new Date().toISOString()
  });
};

const notifyAuctionUpdate = (io, payload) => {
  if (!io || !payload || !payload.proposalId) return;
  const { proposalId } = payload;
  io.to(`proposal-${proposalId}`).emit('auction-update', {
    ...payload,
    timestamp: new Date().toISOString()
  });
};

const notifyMarketData = (io, proposalId, side, marketData) => {
  // Public market data broadcasts disabled intentionally
  return;
};

const notifyUserOrdersUpdate = (io, userAddress, payload = {}) => {
  if (!io || !userAddress) return;
  const address = userAddress.toLowerCase();
  io.to(`user-${address}`).emit('my-orders-updated', {
    address,
    reason: payload.reason || 'orderbook-change',
    changedOrderId: payload.changedOrderId || null,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  notifyOrderBookUpdate,
  notifyNewOrder,
  notifyOrderStatusChange,
  notifyOrderMatched,
  notifyProposalUpdate,
  notifyAuctionUpdate,
  notifyMarketData,
  notifyUserOrdersUpdate
};
