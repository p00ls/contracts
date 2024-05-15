#!/bin/sh

export NO_CONFIRM="1"
export NO_CACHE="1"

# Run devnet and migrations
sleep 5 && npm run devnet:migrate & npm run devnet:node