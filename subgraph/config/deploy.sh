#!/usr/bin/env bash

set -euo pipefail -x

npx graph-compiler --config config/p00ls.json        --include src/datasources --include node_modules/@openzeppelin/subgraphs/src/datasources --export-schema --export-subgraph
npx graph codegen                                      ./generated/p00ls.subgraph.yaml
npx graph deploy --product hosted-service amxx/p00ls   ./generated/p00ls.subgraph.yaml

#npx graph-compiler --config config/p00ls-devel.json   --include src/datasources --include node_modules/@openzeppelin/subgraphs/src/datasources --export-schema --export-subgraph
#npx graph codegen                                            ./generated/p00ls-devel.subgraph.yaml
#npx graph deploy --product hosted-service amxx/p00ls-devel   ./generated/p00ls-devel.subgraph.yaml

#npx graph-compiler --config config/p00ls-staging.json --include src/datasources --include node_modules/@openzeppelin/subgraphs/src/datasources --export-schema --export-subgraph
#npx graph codegen                                            ./generated/p00ls-staging.subgraph.yaml
#npx graph deploy --product hosted-service amxx/p00ls-staging ./generated/p00ls-staging.subgraph.yaml
