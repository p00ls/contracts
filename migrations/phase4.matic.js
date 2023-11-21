const { upgrades                             } = require('hardhat');
const { MigrationManager, getFactory, attach } = require('@amxx/hre/scripts');
const { assert                               } = require('chai');
const DEBUG  = require('debug')('p00ls');
const matic  = require('@maticnetwork/fx-portal/config/config');

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
     *                                                   Registry V2                                                   *
     *******************************************************************************************************************/
    assert.include([137, 80001], network.chainId, 'The migration script is for sidechain (matic & mumbai) only');

    const registry = await manager.cache.get('matic-registry');
    const registryV2Impl = await upgrades.prepareUpgrade(
        registry,
        await getFactory('P00lsCreatorRegistry_Polygon_V2', {signer}),
        { kind: 'uups', constructorArgs: [ network.chainId === 137 ? matic.mainnet.fxChild.address : matic.testnet.fxChild.address ] },
    );

    DEBUG(`- P00lsCreatorRegistry_Polygon_V2 deployed ${registryV2Impl}`);
    const realRegistryV2 = await attach("P00lsCreatorRegistry_Polygon_V2", registry);

    await upgrades.forceImport(
        await realRegistryV2.beaconCreator(),
        await getFactory('P00lsTokenCreator_Polygon'),
        { constructorArgs: [ realRegistryV2.address ] },
    );

    const tokenCreatorV2 = await upgrades.prepareUpgrade(
        await realRegistryV2.beaconCreator(),
        await getFactory('P00lsTokenCreator_Polygon_V2'),
        { constructorArgs: [ realRegistryV2.address ] },
    );

    DEBUG(`- P00lsTokenCreator_Polygon_V2 deployed ${tokenCreatorV2}`);

    await manager.cache.set('matic-tokenCreatorV2', tokenCreatorV2);

    DEBUG(`- manifest filled`);
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