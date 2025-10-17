#!/bin/bash

# Deploy contracts and update frontend addresses
echo "Deploying contracts..."

# Run the deployment
DEPLOY_OUTPUT=$(forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast 2>&1)

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo "Deployment successful!"
    
    # Extract addresses from the output
    PROPOSAL_MANAGER=$(echo "$DEPLOY_OUTPUT" | grep "ProposalManager:" | awk '{print $2}')
    PROPOSAL_IMPL=$(echo "$DEPLOY_OUTPUT" | grep "Proposal Implementation:" | awk '{print $3}')
    MARKET_IMPL=$(echo "$DEPLOY_OUTPUT" | grep "Market Implementation:" | awk '{print $3}')
    MARKET_TOKEN_IMPL=$(echo "$DEPLOY_OUTPUT" | grep "MarketToken Implementation:" | awk '{print $3}')
    
    # Create the JSON file
    cat > ../frontend/contracts/deployed-addresses.json << EOF
{
  "31337": {
    "PROPOSAL_MANAGER": "$PROPOSAL_MANAGER",
    "PROPOSAL_IMPL": "$PROPOSAL_IMPL",
    "MARKET_IMPL": "$MARKET_IMPL",
    "MARKET_TOKEN_IMPL": "$MARKET_TOKEN_IMPL"
  }
}
EOF
    
    echo "Updated frontend/contracts/deployed-addresses.json with new addresses:"
    echo "ProposalManager: $PROPOSAL_MANAGER"
    echo "Proposal Impl: $PROPOSAL_IMPL"
    echo "Market Impl: $MARKET_IMPL"
    echo "MarketToken Impl: $MARKET_TOKEN_IMPL"
else
    echo "Deployment failed!"
    exit 1
fi
