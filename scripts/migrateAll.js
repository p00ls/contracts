const { ethers }   = require('hardhat');
const defaultsDeep = require('lodash.defaultsdeep');

const migrate = require('./migrate');
const merkle  = require('./utils/merkle');

async function migrateAll(config, env) {
    const accounts = await ethers.getSigners();

    // deploy token
    const allocations = [
        { index: 0, account: accounts[0].address, amount: config.extra.DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_DEPLOYER        },
        { index: 1, account: accounts[0].address, amount: config.extra.DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_AUCTION_MANAGER },
    ].filter(x => Object.values(x).every(value => value !== undefined));
    const merkletree = merkle.createMerkleTree(allocations.map(merkle.hashAllocation));

    const migration = await migrate(
        defaultsDeep({
            noCache:   true,
            noConfirm: true,
            contracts: {
                token: {
                    merkleroot: merkletree.getRoot(),
                }
            },
        }, config),
        env,
    );

    await Promise.all(allocations.map(allocation => migration.contracts.token.claim(allocation.index, allocation.account, allocation.amount, merkletree.getHexProof(merkle.hashAllocation(allocation)))));
    await migration.contracts.registry.setBaseURI(config.contracts.registry.baseuri);

    return Object.assign(migration, { accounts });
}

if (require.main === module) {
  const CONFIG = require('./config');
  const ENV    = require('./env');

  migrateAll(CONFIG, ENV)
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = migrateAll;
