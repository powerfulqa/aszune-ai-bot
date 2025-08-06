#!/bin/bash

# This script runs the message chunking test to validate proper word boundary handling
# Usage: ./test-chunking.sh

NODE_ENV=test node ./scripts/test-chunking.js
