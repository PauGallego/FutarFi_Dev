#!/bin/bash

# Deploy contracts and mint WETH, then update frontend addresses
echo "Deploying contracts..."

# Run the deployment
DEPLOY_OUTPUT=$(forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast 2>&1)

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo "Deployment successful!"
    
    # Extract addresses from the deployment output
    PROPOSAL_MANAGER=$(echo "$DEPLOY_OUTPUT" | grep "ProposalManager:" | awk '{print $2}')
    
    echo "Now minting WETH..."
    
    # Run the WETH minting script
    WETH_OUTPUT=$(forge script script/Mintweth.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast 2>&1)
    
    # Check if WETH minting was successful
    if [ $? -eq 0 ]; then
        echo "WETH minting successful!"
        
        # Extract WETH address and balance from the minting output
        WETH_CONTRACT=$(echo "$WETH_OUTPUT" | grep "WETH Contract:" | awk '{print $3}')
        WETH_BALANCE=$(echo "$WETH_OUTPUT" | grep "WETH Balance:" | tail -1 | awk '{print $3}')
        
        # Create the JSON file
        cat > ../frontend/contracts/deployed-addresses.json << EOF
{
  "31337": {
    "WETH": "$WETH_CONTRACT",
    "PROPOSAL_MANAGER": "$PROPOSAL_MANAGER"
  }
}
EOF

        # Update backend .env with ProposalManager address
        ENV_FILE="../backend/.env"
        if [ -z "$PROPOSAL_MANAGER" ]; then
            echo "Warning: Could not extract ProposalManager address from deploy output; skipping .env update."
        else
            if [ -f "$ENV_FILE" ]; then
                if grep -q '^PROPOSAL_MANAGER_ADDRESS=' "$ENV_FILE"; then
                    sed -i -E "s|^PROPOSAL_MANAGER_ADDRESS=.*|PROPOSAL_MANAGER_ADDRESS=$PROPOSAL_MANAGER|" "$ENV_FILE"
                else
                    echo "" >> "$ENV_FILE"
                    echo "PROPOSAL_MANAGER_ADDRESS=$PROPOSAL_MANAGER" >> "$ENV_FILE"
                fi
                echo "Updated backend .env with PROPOSAL_MANAGER_ADDRESS: $PROPOSAL_MANAGER"
            else
                echo "Warning: $ENV_FILE not found; skipping .env update."
            fi
        fi
        
        echo "Updated frontend/contracts/deployed-addresses.json with new addresses:"
        echo "WETH: $WETH_CONTRACT"
        echo "ProposalManager: $PROPOSAL_MANAGER"
        echo "User WETH Balance: $WETH_BALANCE WETH"
        
    else
        echo "WETH minting failed!"
        exit 1
    fi

else
    echo "Deployment failed!"
    exit 1
fi
