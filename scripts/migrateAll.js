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

    // claim all allocations
    await Promise.all(allocations.map(allocation => migration.contracts.token.claim(allocation.index, allocation.account, allocation.amount, merkletree.getHexProof(merkle.hashAllocation(allocation)))));

    // create a fake signer for the timelock (for easier testing)
    await hre.network.provider.request({ method: 'hardhat_impersonateAccount', params: [ migration.contracts.timelock.address ] });
    accounts.superAdmin = await ethers.getSigner(migration.contracts.timelock.address);
    await accounts[0].sendTransaction({ to: accounts.superAdmin.address, value: ethers.utils.parseEther('1') });

    // set uri using the super admin
    await migration.contracts.registry.connect(accounts.superAdmin).setBaseURI(config.contracts.registry.baseuri);

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
