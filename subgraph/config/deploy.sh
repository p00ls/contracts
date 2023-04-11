#!/usr/bin/env bash

set -euo pipefail -x

#npx graph-compiler --config config/p00ls.json        --include src/datasources --include node_modules/@openzeppelin/subgraphs/src/datasources --export-schema --export-subgraph
#npx graph codegen                                      ./generated/p00ls.subgraph.yaml
#npx graph deploy p00ls/production   ./generated/p00ls.subgraph.yaml --ipfs https://api.thegraph.com/ipfs/ --node http://localhost:8020 --debug

#npx graph-compiler --config config/p00ls-devel.json   --include src/datasources --include node_modules/@openzeppelin/subgraphs/src/datasources --export-schema --export-subgraph
#npx graph codegen                                            ./generated/p00ls-devel.subgraph.yaml
#npx graph deploy --product hosted-service amxx/p00ls-devel   ./generated/p00ls-devel.subgraph.yaml

#npx graph-compiler --config config/p00ls-staging-goerli.json --include src/datasources --include node_modules/@openzeppelin/subgraphs/src/datasources --export-schema --export-subgraph
#npx graph codegen                                            ./generated/p00ls-staging-goerli.subgraph.yaml
#npx graph create --node http://localhost:8020 p00ls/staging-goerli
#npx graph deploy p00ls/staging-goerli ./generated/p00ls-staging-goerli.subgraph.yaml --ipfs https://api.thegraph.com/ipfs/ --node http://localhost:8020 --debug
