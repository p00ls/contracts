# P00ls Contracts

## Introduction

This repo contains the smart contract for the [p00ls](https://www.p00ls.io/) platform.

Some parts of these contracts are still being worked on and might change. See the [status](#Status) section below.

## Setup

### Environment

The development and test environments are configured through environment variables. It is recommended to configure that using a `.env` file. The `.env.example` provides an example of such file, with the different variables listed.

The main variables used are:

- **MODE**: use production to enable optimization
- **REVERT_STRINGS**: if set to strip, this option removes all the revert reasons
- **XXX_NODE**: rpc endpoint for chain `XXX` (for migration scripts)
- **MNEMONIC**: mnemonic of the wallet to use (for migration scripts)
- **PRIVATE_KEY**: private key of the wallet to use (for migration scripts)

If both `MNEMONIC` and `PRIVATE_KEY` are defined, `MNEMONIC` will take priority.

- **COVERAGE**: enable the coverage plugin (needed to produce coverage reports)
- **REPORT**: enable the gas report plugin (will produce gas usage reports when running the tests)
- **DEBUG**: add extra debug. Set `DEBUG=migration` for extra verbosity during deployments.

### Contract configuration

The contract deployment script takes its parameters from the `scripts/config.js` file. This file contains can be used to customize the deployment. If anyone wants to perform a deployment of these contracts, it is strongly encouraged to read the deployment script AND do test deployments.

## Compile

To compile the contract smart contracts, run

```
npm run compile
```

## Run tests

- Tests are run using the following command

```
npm run test
```

- Gas usage report can be produced by adding `REPORT=true` to the command line or to the `.env` configuration file

- Code coverage report can be produced by adding `COVERAGE=true` to the command line or to the `.env` configuration file and running

```
npm run coverage
```

## Deploy

In other to deploy these contracts, one should fill two different files:

- the `.env` file must contain credentials (private key or mnemonic) and an url endpoint for the targeted blockchain.
- the `scripts/config.js` file must contain the deploying arguments for the contracts (name, symbol, ...).

See the [setup](#Setup) section to learn more about the environment configuration.

Once the settings are configured, you can use the `scripts/migrate.js` script with the following command:

```
npx hardhat run scripts/migrate.js --network <blockchain-name>
```

The migration script will produce a `.cache-<chainId>.json` file containing the addresses of the deployed contracts.

Note: the deployment workflow is still being worked on.

## Architecture

![architecture](imgs/architecture.jpg)

## Status

| Contract name                                                     | Status           | Audited     | Deployment | Upgradeable        |
|-------------------------------------------------------------------|------------------|-------------|------------|--------------------|
| [P00lsCreatorRegistry](contracts/tokens/P00lsCreatorRegistry.sol) | Finalized        | In progress | -          | :heavy_check_mark: |
| [P00lsTokenCreator](contracts/tokens/P00lsTokenCreator.sol)       | Finalized        | In progress | -          | :heavy_check_mark: |
| [P00lsTokenXCreator](contracts/tokens/P00lsTokenXCreator.sol)     | Finalized        | In progress | -          | :heavy_check_mark: |
| [AMM Router](contracts/finance/amm/UniswapV2Router02.sol)         | Finalized        | In progress | -          | :x:                |
| [AMM Factory](contracts/finance/amm/UniswapV2Factory.sol)         | Finalized        | In progress | -          | :x:                |
| [AMM Pair](contracts/finance/amm/UniswapV2Pair.sol)               | Finalized        | In progress | -          | :x:                |
| [AuctionFactory](contracts/finance/auction/AuctionFactory.sol)    | Finalized        | In progress | -          | :x:                |
| [Auction](contracts/finance/auction/Auction.sol)                  | Finalized        | In progress | -          | :x:                |
| [VestedAirdrops](contracts/finance/vesting/VestedAirdrops.sol)    | Finalized        | In progress | -          | :x:                |
| [Escrow](contracts/finance/staking/Escrow.sol)                    | Finalized        | In progress | -          | :x:                |
| [Locking](contracts/finance/locking/Locking.sol)                  | Work in progress | -           | -          | :x:                |
| [DAO Governor](contracts/dao/P00lsDAO.sol)                        | Work in progress | -           | -          | :x:                |
| [DAO Timelock](contracts/dao/P00lsTimelock.sol)                   | Work in progress | -           | -          | :x:                |
