// WebSocket notification helpers

const notifyOrderBookUpdate = (io, proposalId, side, orderBook) => {
  io.to(`orderbook-${proposalId}-${side}`).emit('orderbook-update', {
    proposalId,
    side,
    orderBook,
    timestamp: new Date().toISOString()
  });
};

const notifyNewOrder = (io, order) => {
  io.to(`proposal-${order.proposalId}`).emit('new-order', {
    order,
    timestamp: new Date().toISOString()
  });
  
  io.to(`orderbook-${order.proposalId}-${order.side}`).emit('new-order', {
    order,
    timestamp: new Date().toISOString()
  });
};

const notifyOrderStatusChange = (io, order, oldStatus) => {
  io.to(`proposal-${order.proposalId}`).emit('order-status-change', {
    order,
    oldStatus,
    newStatus: order.status,
    timestamp: new Date().toISOString()
  });
};

const notifyOrderMatched = (io, buyOrder, sellOrder, matchedAmount, matchedPrice) => {
  const matchData = {
    buyOrder,
    sellOrder,
    matchedAmount,
    matchedPrice,
    timestamp: new Date().toISOString()
  };

  io.to(`proposal-${buyOrder.proposalId}`).emit('order-matched', matchData);
  io.to(`orderbook-${buyOrder.proposalId}-${buyOrder.side}`).emit('order-matched', matchData);
};

const notifyProposalUpdate = (io, proposal) => {
  io.to(`proposal-${proposal.id}`).emit('proposal-update', {
    proposal,
    timestamp: new Date().toISOString()
  });
};

const notifyMarketData = (io, proposalId, side, marketData) => {
  io.to(`orderbook-${proposalId}-${side}`).emit('market-data', {
    proposalId,
    side,
    ...marketData,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  notifyOrderBookUpdate,
  notifyNewOrder,
  notifyOrderStatusChange,
  notifyOrderMatched,
  notifyProposalUpdate,
  notifyMarketData
};
