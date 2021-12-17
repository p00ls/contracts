const { ethers, upgrades }         = require('hardhat');
const defaultsDeep                 = require('lodash.defaultsdeep');
const { MigrationManager, attach } = require('@amxx/hre/scripts');

const migrate = require('./migrate');
const merkle = require('./utils/merkle');
const DEBUG  = require('debug')('p00ls');

async function migrateAll(config, env) {
    const provider = ethers.provider;
    const accounts = await ethers.getSigners();
    const signer   = accounts[0];

    const manager  = new MigrationManager(provider);
    await manager.ready().then(() => manager.cache.clear());

    // First deployment phase
    const { contracts, roles } = await migrate(
        defaultsDeep({ noConfirm: true }, config),
        env,
    );

    await contracts.registry.setBaseURI(config.contracts.registry.baseuri);

    // deploy token
    const newCreatorToken = (admin, name, symbol, xname, xsymbol, root) => contracts.registry.createToken(admin, name, symbol, xname, xsymbol, root)
        .then(tx => tx.wait())
        .then(receipt => receipt.events.find(({ event }) => event === 'Transfer'))
        .then(event => event.args.tokenId)
        .then(tokenId => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.zeroPad(tokenId, 20))))
        .then(address => attach('P00lsTokenCreator', address));

    const getXCreatorToken = (creatorToken) => creatorToken.xCreatorToken()
        .then(address => attach('P00lsTokenXCreator', address));

    const allocations = [
        { index: 0, account: signer.address,            amount: config.extra.DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_DEPLOYER        },
        { index: 1, account: contracts.auction.address, amount: config.extra.DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_AUCTION_MANAGER },
    ].filter(x => Object.values(x).every(value => value !== undefined));
    const merkletree = merkle.createMerkleTree(allocations.map(merkle.hashAllocation));

    const token = await newCreatorToken(
      signer.address,
      config.contracts.token.name,
      config.contracts.token.symbol,
      config.contracts.token.xname,
      config.contracts.token.xsymbol,
      merkletree.getRoot(),
    );
    const xToken = await getXCreatorToken(token);

    await Promise.all(allocations.map(allocation => token.claim(allocation.index, allocation.account, allocation.amount, merkletree.getHexProof(merkle.hashAllocation(allocation)))));
    DEBUG(`Token:     ${token.address}`);
    DEBUG(`xToken:    ${xToken.address}`);

    // Second deployment phase
    const { contracts: moreContracts } = await migrate(
        defaultsDeep({ noConfirm: true, contracts: { token: { disabled: false, address: token.address }}}, config),
        env,
    );

    return {
        accounts,
        roles,
        contracts: {
            ...moreContracts,
            token,
            xToken,
        },
        workflows: {
            newCreatorToken,
            getXCreatorToken,
        },
    };
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
