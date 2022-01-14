const { upgrades                             } = require('hardhat');
const { MigrationManager, getFactory, attach } = require('@amxx/hre/scripts');
const DEBUG = require('debug')('p00ls');

upgrades.silenceWarnings();

async function migrate(config = {}, env = {}) {

    const provider = env.provider || ethers.provider;
    const signer   = env.signer   || await ethers.getSigner();
    const network  = await ethers.provider.getNetwork();
    const manager  = new MigrationManager(provider);

    // Put known addresses into the cache
    await manager.ready().then(() => Promise.all(
        Object.entries(env[network.chainId] || {}).map(([ name, address ]) => manager.cache.set(name, address))
    ));

    const opts = { noCache: config.noCache, noConfirm: config.noConfirm };
    const isEnabled = (...keys) => keys.every(key => !config.contracts[key]?.disabled);

    /*******************************************************************************************************************
     *                                                   Environment                                                   *
     *******************************************************************************************************************/
    const weth = isEnabled('weth') && await manager.migrate(
        'weth',
        getFactory('WETH', { signer }),
        { ...opts },
    );

    const multicall = isEnabled('multicall') && await manager.migrate(
        'multicall',
        getFactory('UniswapInterfaceMulticall', { signer }),
        { ...opts },
    );

    /*******************************************************************************************************************
     *                                                       DAO                                                       *
     *******************************************************************************************************************/
    const timelock = isEnabled('timelock') && await manager.migrate(
        'timelock',
        getFactory('TimelockController', { signer }),
        [
            config.contracts.timelock.mindelay,
            [],
            [],
        ],
        { ...opts },
    );

    const dao = isEnabled('dao', 'token') && timelock && await manager.migrate(
        'dao',
        getFactory('P00lsDAO', { signer }),
        [
            config.contracts.token.address,
            timelock.address,
        ],
        { ...opts,  kind: 'uups' },
    );

    /*******************************************************************************************************************
     *                                                     Vesting                                                     *
     *******************************************************************************************************************/
    const vesting = isEnabled('vesting') && await manager.migrate(
        'vesting',
        getFactory('VestedAirdrops', { signer }),
        [
            signer.address,
        ],
        { ...opts },
    );

    /*******************************************************************************************************************
     *                                                  P00ls creator                                                  *
     *******************************************************************************************************************/
    const escrow = isEnabled('escrow') && await manager.migrate(
        'escrow',
        getFactory('Escrow', { signer }),
        [
            signer.address,
        ],
        { ...opts },
    );

    const registry = isEnabled('registry') && await manager.migrate(
        'registry',
        getFactory('P00lsCreatorRegistry', { signer }),
        [
            signer.address,
            config.contracts.registry.name,
            config.contracts.registry.symbol,
        ],
        { ...opts, kind: 'uups', unsafeAllow: 'delegatecall' },
    );

    const tokenCreator = isEnabled('registry') && registry && await manager.migrate(
        'tokenCreator',
        getFactory('P00lsTokenCreator', { signer }),
        [
            registry.address,
        ],
        { ...opts, noConfirm: true },
    );

    const tokenXCreator = isEnabled('registry') && registry && await manager.migrate(
        'tokenXCreator',
        getFactory('P00lsTokenXCreator', { signer }),
        [
            escrow.address,
        ],
        { ...opts, noConfirm: true },
    );

    /*******************************************************************************************************************
     *                                                       AMM                                                       *
     *******************************************************************************************************************/
    const factory = isEnabled('amm') && await manager.migrate(
        'amm-factory',
        getFactory('UniswapV2Factory', { signer }),
        [
            signer.address,
        ],
        { ...opts },
    );

    const router = isEnabled('amm') && factory && await manager.migrate(
        'amm-router',
        getFactory('UniswapV2Router02', { signer }),
        [
            factory.address,
            weth.address,
        ],
        { ...opts, noConfirm: true },
    );

    const auction = isEnabled('auction') && router && await manager.migrate(
        'auction',
        getFactory('AuctionFactory', { signer }),
        [
            signer.address,
            router.address,
        ],
        { ...opts },
    );

    /*******************************************************************************************************************
     *                                                     Locking                                                     *
     *******************************************************************************************************************/
    const locking = isEnabled('locking', 'token') && router && await manager.migrate(
        'locking',
        getFactory('Locking', { signer }),
        [
            signer.address,
            router.address,
            config.contracts.token.address,
        ],
        { ...opts },
    );

    /*******************************************************************************************************************
     *                                                       AMM                                                       *
     *******************************************************************************************************************/
    const roles = await Promise.all(Object.entries({
        DEFAULT_ADMIN:    ethers.constants.HashZero,
        PAIR_CREATOR:     ethers.utils.id('PAIR_CREATOR_ROLE'),
        VESTING_MANAGER:  ethers.utils.id('VESTING_MANAGER_ROLE'),
        AUCTION_MANAGER:  ethers.utils.id('AUCTION_MANAGER_ROLE'),
        ESCROW_MANAGER:   ethers.utils.id('ESCROW_MANAGER_ROLE'),
        LOCKING_MANAGER:  ethers.utils.id('LOCKING_MANAGER_ROLE'),
        REGISTRY_MANAGER: ethers.utils.id('REGISTRY_MANAGER_ROLE'),
        UPGRADER:         ethers.utils.id('UPGRADER_ROLE'),
    }).map(entry => Promise.all(entry))).then(Object.fromEntries);

    await Promise.all([].concat(
        factory && factory.feeTo().then(address => address == timelock.address || factory.setFeeTo(timelock.address)),
        factory && factory.hasRole(roles.PAIR_CREATOR,  auction.address ).then(yes => yes || factory.grantRole   (roles.PAIR_CREATOR,  auction.address )),
        factory && factory.hasRole(roles.DEFAULT_ADMIN, timelock.address).then(yes => yes || factory.grantRole   (roles.DEFAULT_ADMIN, timelock.address)),
        factory && factory.hasRole(roles.DEFAULT_ADMIN, signer.address  ).then(yes => yes && factory.renounceRole(roles.DEFAULT_ADMIN, signer.address  )),
        registry && tokenCreator && registry.beaconCreator()
            .then(address => attach('Beacon', address))
            .then(beacon => beacon.implementation())
            .then(implementation => implementation == tokenCreator.address || registry.upgradeCreatorToken(tokenCreator.address)),
        registry && tokenXCreator && registry.beaconXCreator()
            .then(address => attach('Beacon', address))
            .then(beacon => beacon.implementation())
            .then(implementation => implementation == tokenXCreator.address || registry.upgradeXCreatorToken(tokenXCreator.address)),
    ));

    weth      && DEBUG(`WETH:      ${weth.address     }`);
    multicall && DEBUG(`Multicall: ${multicall.address}`);
    timelock  && DEBUG(`Timelock:  ${timelock.address }`);
    dao       && DEBUG(`Dao:       ${dao.address      }`);
    vesting   && DEBUG(`Vesting:   ${vesting.address  }`);
    escrow    && DEBUG(`Escrow:    ${escrow.address   }`);
    registry  && DEBUG(`Registry:  ${registry.address }`);
    factory   && DEBUG(`Factory:   ${factory.address  }`);
    router    && DEBUG(`Router:    ${router.address   }`);
    auction   && DEBUG(`Auction:   ${auction.address  }`);
    locking   && DEBUG(`Locking:   ${locking.address  }`);

    return {
        config,
        roles,
        contracts: {
            weth,
            multicall,
            timelock,
            dao,
            vesting,
            escrow,
            registry,
            factory,
            router,
            auction,
            locking,
        },
    };
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

module.exports = migrate;