#!/bin/sh

# Run devnet and migrations
export NO_CONFIRM="1"
npm run devnet:node & npm run devnet:migrate;