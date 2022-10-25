const { upgrades                             } = require('hardhat');
const { MigrationManager, getFactory, attach } = require('@amxx/hre/scripts');
const DEBUG  = require('debug')('p00ls');

const roles = {
    DEFAULT_ADMIN:    ethers.constants.HashZero,
    PAIR_CREATOR:     ethers.utils.id('PAIR_CREATOR_ROLE'),
    VESTING_MANAGER:  ethers.utils.id('VESTING_MANAGER_ROLE'),
    AUCTION_MANAGER:  ethers.utils.id('AUCTION_MANAGER_ROLE'),
    ESCROW_MANAGER:   ethers.utils.id('ESCROW_MANAGER_ROLE'),
    LOCKING_MANAGER:  ethers.utils.id('LOCKING_MANAGER_ROLE'),
    REGISTRY_MANAGER: ethers.utils.id('REGISTRY_MANAGER_ROLE'),
    UPGRADER:         ethers.utils.id('UPGRADER_ROLE'),
};

upgrades.silenceWarnings();

async function migrate(config = {}, env = {}) {
    const provider = env.provider || ethers.provider;
    const signer   = env.signer   || await ethers.getSigner();
    const network  = await ethers.provider.getNetwork();
    const manager  = new MigrationManager(provider);
    signer.address = await signer.getAddress();

    DEBUG(`Network:  ${network.name} (${network.chainId})`);
    DEBUG(`Deployer: ${signer.address}`);
    DEBUG('----------------------------------------------------');

    // Put known addresses into the cache
    await manager.ready().then(() => Promise.all(Object.entries(env[network.chainId] || {}).map(([ name, address ]) => manager.cache.set(name, address))));
    const opts = { noCache: config.noCache, noConfirm: config.noConfirm };

    /*******************************************************************************************************************
     *                                            Auction factory redeploy                                             *
     *******************************************************************************************************************/
    const auction = await manager.migrate(
        'auction',
        getFactory('AuctionFactory', { signer }),
        [
            config.admin,
            await manager.cache.get('amm-router'),
            await manager.cache.get('00'),
            config.admin, // LP receiver
        ],
        { ...opts, noCache: true },
    );

    DEBUG(`- auction deployed ${auction.address}`);

    DEBUG(`Please execute "${await manager.cache.get('amm-factory')}.grantRole(${roles.PAIR_CREATOR}, ${auction.address})"`);
}

if (require.main === module) {
    const CONFIG = require('./config');
    const ENV    = require('./env');

    migrate(CONFIG, ENV)
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    migrate,
};