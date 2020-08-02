#!/bin/bash
echo "Compiling contract..."
truffle compile
echo "Copying build to publisher..."
cp -r ./build ../publisher
echo "Deploying contract onto local node..."
echo $(truffle migrate | grep 'contract address' | tail -1 | sed 's/^.*: //') > contract-address.txt
echo "Deployed contract!"
echo "Copying contract address to publisher..."
cp ./contract-address.txt ../publisher/contract-address.txt
