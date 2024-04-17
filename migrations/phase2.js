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
     *                                                  P00ls creator                                                  *
     *******************************************************************************************************************/
    const escrow = await manager.migrate(
        'escrow',
        getFactory('Escrow', { signer }),
        [
            config.admin,
        ],
        { ...opts, noCache: true },
    );

    DEBUG(`- escrow deployed        ${escrow.address}`);

    // ------ Token templates ----------------------------------------------------------------------------------------
    const registry = await manager.cache.get('registry').then(address => attach('P00lsCreatorRegistry', address));

    const tokenXCreator = await upgrades.prepareUpgrade(
        await registry.beaconXCreator(),
        await getFactory('P00lsTokenXCreator_V2', { signer }),
        { constructorArgs: [ escrow.address ], unsafeAllow: 'delegatecall' },
    );

    DEBUG(`- tokenXCreator deployed ${tokenXCreator}`);

    await manager.cache.set('tokenXCreatorV2', tokenXCreator);

    DEBUG(`- manifest filled`);

    /*******************************************************************************************************************
     *                                                       AMM                                                       *
     *******************************************************************************************************************/
    const factory = await manager.migrate(
        'amm-factory',
        getFactory('UniswapV2Factory', { signer }),
        [
            signer.address, // don't use admin here, we'll transfer the right later
        ],
        { ...opts },
    );

    DEBUG(`- factory deployed       ${factory.address}`);

    const router = factory && await manager.migrate(
        'amm-router',
        getFactory('UniswapV2Router02', { signer }),
        [
            factory.address,
            await manager.cache.get('weth'),
        ],
        { ...opts },
    );

    DEBUG(`- router deployed        ${router.address}`);

    const auction = await manager.migrate(
        'auction',
        getFactory('AuctionFactory', { signer }),
        [
            config.admin,
            router.address,
            await manager.cache.get('00'),
            config.admin, // LP receiver
        ],
        { ...opts },
    );

    DEBUG(`- auction deployed       ${auction.address}`);

    const feemanager = await manager.migrate(
        'feemanager',
        getFactory('FeeManager', { signer }),
        [
            config.admin,
            router.address,
            await manager.cache.get('00'),
            config.admin, // Recipient
            config.contracts.feeManager.fee,
        ],
        { ...opts },
    );

    DEBUG(`- feemanager deployed    ${feemanager.address}`);

    // ------ Setup roles --------------------------------------------------------------------------------------------

    // set fees to feemanager
    await factory.feeTo().then(address => address == feemanager.address || factory.setFeeTo(feemanager.address).then(tx => tx.wait()));
    // allow auction to create pairs
    await factory.hasRole      (roles.PAIR_CREATOR,  auction.address).then(yes => yes || factory.grantRole    (roles.PAIR_CREATOR,  auction.address).then(tx => tx.wait()));
    // transfer factory admin from signer to admin
    await factory.hasRole      (roles.DEFAULT_ADMIN, config.admin   ).then(yes => yes || factory.grantRole    (roles.DEFAULT_ADMIN, config.admin   ).then(tx => tx.wait()));
    await factory.hasRole      (roles.DEFAULT_ADMIN, signer.address ).then(yes => yes && factory.renounceRole (roles.DEFAULT_ADMIN, signer.address ).then(tx => tx.wait()));

    DEBUG(`- permissions setup`);
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