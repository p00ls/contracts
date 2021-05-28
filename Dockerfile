FROM trufflesuite/ganache-cli:latest as build

USER root

RUN apk add --no-cache bash gcc g++ git make python

RUN mkdir /ganachedb
COPY contracts         ./contracts
COPY scripts           ./scripts
COPY hardhat.config.js ./hardhat.config.js
COPY package.json      ./package.json

# ARG MNEMONIC

RUN bash scripts/migrate.sh

FROM trufflesuite/ganache-cli:latest as runtime

COPY --from=build "/ganachedb" "/ganachedb"

ENTRYPOINT ["node", "/app/ganache-core.docker.cli.js"]
CMD ["-l", "12500000", "-i", "65535", "--hardfork", "istanbul", "--db", "/ganachedb"]
