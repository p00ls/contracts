const {
    MigrationManager,
    getFactory,
    attach,
} = require('@amxx/hre/scripts');

const DEBUG  = require('debug')('p00ls');
const CONFIG = require('./defaultConfig');
const ENV    = require('./env');

async function deploy(config = {}, env = {}) {

    const provider = await ethers.provider;
    const network  = await ethers.provider.getNetwork();
    const signer   = await ethers.getSigner();

    const manager = new MigrationManager(provider);

    // Put known addresses into the cache
    await manager.ready().then(() => Promise.all(
        Object.entries(ENV[network.chainId] || {}).map(([ name, address ]) => manager.cache.set(name, address))
    ));

    const opts = { noCache: config.noCache, noConfirm: CONFIG.noConfirm };

    /*******************************************************************************************************************
     *                                                   Environment                                                   *
     *******************************************************************************************************************/
    const weth = await manager.migrate(
        'weth',
        getFactory('WETH', { signer }),
        { ...opts },
    );

    const multicall = await manager.migrate(
        'multicall',
        getFactory('UniswapInterfaceMulticall', { signer }),
        { ...opts },
    );

    /*******************************************************************************************************************
     *                                                       DAO                                                       *
     *******************************************************************************************************************/
    const timelock = await manager.migrate(
        'timelock',
        getFactory('TimelockController', { signer }),
        [
            CONFIG.timelock.mindelay,
            [],
            [],
        ],
        { ...opts },
    );

    // const dao = await manager.migrate(
    //     'dao',
    //     getFactory('P00lsDAO', { signer }),
    //     [
    //         token.address, // TODO: pools token address
    //         timelock.address,
    //     ],
    //     {
    //         kind: 'uups'
    //     },
    //     { ...opts },
    // );

    /*******************************************************************************************************************
     *                                                     Vesting                                                     *
     *******************************************************************************************************************/
    const vesting = await manager.migrate(
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
    const escrow = await manager.migrate(
        'escrow',
        getFactory('Escrow', { signer }),
        [
            signer.address,
        ],
        { ...opts },
    );

    const registry = await manager.migrate(
        'registry',
        getFactory('P00lsCreatorRegistry', { signer }),
        [
            signer.address,
            CONFIG.registry.name,
            CONFIG.registry.symbol,
        ],
        {
            ...opts,
            kind: 'uups',
        },
    );

    const tokenCreator = await manager.migrate(
        'tokenCreator',
        getFactory('P00lsTokenCreator', { signer }),
        [
            registry.address,
        ],
        { ...opts },
    );

    const tokenXCreator = await manager.migrate(
        'tokenXCreator',
        getFactory('P00lsTokenXCreator', { signer }),
        [
            escrow.address,
        ],
        { ...opts },
    );

    /*******************************************************************************************************************
     *                                                       AMM                                                       *
     *******************************************************************************************************************/
    const factory = await manager.migrate(
        'amm-factory',
        getFactory('UniswapV2Factory', { signer }),
        [
            signer.address,
        ],
        { ...opts },
    );

    const router = await manager.migrate(
        'amm-router',
        getFactory('UniswapV2Router02', { signer }),
        [
            factory.address,
            weth.address,
        ],
        { ...opts },
    );

    const auction = await manager.migrate(
        'auction',
        getFactory('AuctionManager', { signer }),
        [
            signer.address,
            router.address,
        ],
        { ...opts },
    );

    /*******************************************************************************************************************
     *                                                     Locking                                                     *
     *******************************************************************************************************************/
    // const auction = await manager.migrate(
    //     'locking',
    //     getFactory('Locking', { signer }),
    //     [
    //         signer.address,
    //         router.address,
    //         token.address, // TODO: pools token address
    //     ],
    //     { ...opts },
    // );

    /*******************************************************************************************************************
     *                                                       AMM                                                       *
     *******************************************************************************************************************/
    const roles = await Promise.all(Object.entries({
        DEFAULT_ADMIN: ethers.constants.HashZero,
        PAIR_CREATOR:  factory.PAIR_CREATOR_ROLE(),
    }).map(entry => Promise.all(entry))).then(Object.fromEntries);

    await Promise.all([].concat(
        factory.feeTo().then(address => address == timelock.address || factory.setFeeTo(timelock.address)),
        factory.hasRole(roles.PAIR_CREATOR,  auction.address ).then(yes => yes || factory.grantRole   (roles.PAIR_CREATOR,  auction.address )),
        factory.hasRole(roles.DEFAULT_ADMIN, timelock.address).then(yes => yes || factory.grantRole   (roles.DEFAULT_ADMIN, timelock.address)),
        factory.hasRole(roles.DEFAULT_ADMIN, signer.address  ).then(yes => yes && factory.renounceRole(roles.DEFAULT_ADMIN, signer.address  )),
        registry.beaconCreator()
            .then(address => attach('Beacon', address))
            .then(beacon => beacon.implementation())
            .then(implementation => implementation == tokenCreator.address || registry.upgradeCreatorToken(tokenCreator.address)),
        registry.beaconXCreator()
            .then(address => attach('Beacon', address))
            .then(beacon => beacon.implementation())
            .then(implementation => implementation == tokenXCreator.address || registry.upgradeXCreatorToken(tokenXCreator.address)),
    ));

    weth      && DEBUG(`WETH:      ${weth.address     }`);
    multicall && DEBUG(`Multicall: ${multicall.address}`);
    timelock  && DEBUG(`Timelock:  ${timelock.address }`);
    // dao       && DEBUG(`Dao:       ${dao.address      }`);
    vesting   && DEBUG(`Vesting:   ${vesting.address  }`);
    escrow    && DEBUG(`Escrow:    ${escrow.address   }`);
    registry  && DEBUG(`Registry:  ${registry.address }`);
    factory   && DEBUG(`Factory:   ${factory.address  }`);
    router    && DEBUG(`Router:    ${router.address   }`);
    // auction   && DEBUG(`Auction:   ${auction.address  }`);
}

if (require.main === module) {
  deploy(CONFIG, ENV)
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
