#!/bin/sh

# Run devnet and migrations
export NO_CONFIRM="1"
sleep 5 && npm run devnet:migrate & npm run devnet:node