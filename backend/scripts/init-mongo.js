// MongoDB initialization script
db = db.getSiblingDB('futarfi-price-history');

// Create collections with indexes
db.createCollection('proposals');
db.createCollection('price_history');

// Create indexes for proposals collection
db.proposals.createIndex({ "proposalId": 1 }, { unique: true });
db.proposals.createIndex({ "admin": 1 });
db.proposals.createIndex({ "isActive": 1 });
db.proposals.createIndex({ "startTime": 1, "endTime": 1 });
db.proposals.createIndex({ "contractAddress": 1 });
db.proposals.createIndex({ "marketAddress": 1 });

// Create indexes for price_history collection
db.price_history.createIndex({ "proposalId": 1, "marketType": 1, "timestamp": -1 });
db.price_history.createIndex({ "proposalId": 1, "timestamp": -1 });
db.price_history.createIndex({ "marketType": 1, "timestamp": -1 });
db.price_history.createIndex({ "blockNumber": 1 });
db.price_history.createIndex({ "timestamp": -1 });

print('Database initialized with indexes');

// Create a test user (optional)
// db.createUser({
//   user: "futarfi_user",
//   pwd: "futarfi_password",
//   roles: [
//     {
//       role: "readWrite",
//       db: "futarfi-price-history"
//     }
//   ]
// });
