#!/bin/bash

echo "Cleaning up npm installation..."
echo

# Remove node_modules
echo "Removing node_modules folder..."
if [ -d "node_modules" ]; then
  rm -rf node_modules
  echo "Node modules removed."
else
  echo "No node_modules folder found."
fi
echo

# Clear npm cache
echo "Clearing npm cache..."
npm cache clean --force
echo

# Install dependencies
echo "Installing dependencies..."
npm ci

# Check if npm ci failed
if [ $? -ne 0 ]; then
  echo "npm ci failed, trying regular npm install..."
  npm install
fi

echo
echo "Installation completed!"
