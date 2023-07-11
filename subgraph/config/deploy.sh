#!/usr/bin/env bash

set -euo pipefail -x

#npx graph-compiler --config config/p00ls.json        --include src/datasources --include node_modules/@openzeppelin/subgraphs/src/datasources --export-schema --export-subgraph
#npx graph codegen                                      ./generated/p00ls.subgraph.yaml
#npx graph deploy p00ls/production   ./generated/p00ls.subgraph.yaml --ipfs https://ipfs.network.thegraph.com --node http://localhost:8020 --debug

#npx graph-compiler --config config/p00ls-staging-goerli.json --include src/datasources --include node_modules/@openzeppelin/subgraphs/src/datasources --export-schema --export-subgraph
#npx graph codegen                                            ./generated/p00ls-staging-goerli.subgraph.yaml
#npx graph create --node http://localhost:8020 p00ls/staging-goerli
#npx graph deploy p00ls/staging-goerli ./generated/p00ls-staging-goerli.subgraph.yaml --ipfs https://ipfs.network.thegraph.com --node http://localhost:8020 --debug

#npx graph-compiler --config config/p00ls-staging-mumbai.json --include src/datasources --include node_modules/@openzeppelin/subgraphs/src/datasources --export-schema --export-subgraph
#npx graph codegen                                            ./generated/p00ls-staging-mumbai.subgraph.yaml
#npx graph create --node http://localhost:8020 p00ls/staging-mumbai
#npx graph deploy p00ls/staging-mumbai ./generated/p00ls-staging-mumbai.subgraph.yaml --ipfs https://ipfs.network.thegraph.com --node http://localhost:8020 --debug

#npx graph-compiler --config config/p00ls-production-polygon.json --include src/datasources --include node_modules/@openzeppelin/subgraphs/src/datasources --export-schema --export-subgraph
#npx graph codegen                                            ./generated/p00ls-production-polygon.subgraph.yaml
#npx graph create --node http://localhost:8020 p00ls/production-polygon
#npx graph deploy p00ls/production-polygon ./generated/p00ls-production-polygon.subgraph.yaml --ipfs https://ipfs.network.thegraph.com --node http://localhost:8020 --debug
