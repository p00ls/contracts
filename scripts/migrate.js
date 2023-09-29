const { upgrades                             } = require('hardhat');
const { MigrationManager, getFactory, attach } = require('@amxx/hre/scripts');
const DEBUG = require('debug')('p00ls');

upgrades.silenceWarnings();

async function migrate(config = {}, env = {})
{
    const provider = env.provider || ethers.provider;
    const signer   = env.signer   || await ethers.getSigner();
    const network  = await ethers.provider.getNetwork();
    const manager  = new MigrationManager(provider);
    signer.address =await signer.getAddress();

    DEBUG(`network: ${network.name} (${network.chainId})`);
    DEBUG(`signer:  ${signer.address}`);

    // Put known addresses into the cache
    await manager.ready().then(() => Promise.all(Object.entries(env[network.chainId] || {}).map(([ name, address ]) => manager.cache.set(name, address))));

    const opts = { noCache: config.noCache, noConfirm: config.noConfirm };
    const isEnabled = (...keys) => keys.every(key => !config.contracts[key]?.disabled);

    // encode dependency
    config.contracts['auction'] = isEnabled('auction', 'token');
    config.contracts['dao'    ] = isEnabled('dao',     'token');
    config.contracts['locking'] = isEnabled('locking', 'token');

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
     *                                                     Vesting                                                     *
     *******************************************************************************************************************/
    const vestedAirdrop = isEnabled('vesting') && await manager.migrate(
        'vesting',
        getFactory('VestedAirdrops', { signer }),
        [
            signer.address,
        ],
        { ...opts },
    );

    const vestingFactory = isEnabled('vesting') && await manager.migrate(
        'vestingFactory',
        getFactory('VestingFactory', { signer }),
        [],
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

    // ------ Creator registry ---------------------------------------------------------------------------------------
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

    // ------ Token templates ----------------------------------------------------------------------------------------
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

    // ------ Setup beacons ------------------------------------------------------------------------------------------
    isEnabled('registry') && await registry.beaconCreator()
        .then(address => attach('Beacon', address))
        .then(beacon => beacon.implementation())
        .then(implementation => implementation == tokenCreator.address || registry.upgradeCreatorToken(tokenCreator.address).then(tx => tx.wait()));

    isEnabled('registry') && await registry.beaconXCreator()
        .then(address => attach('Beacon', address))
        .then(beacon => beacon.implementation())
        .then(implementation => implementation == tokenXCreator.address || registry.upgradeXCreatorToken(tokenXCreator.address).then(tx => tx.wait()));

    // ------ Tooling ------------------------------------------------------------------------------------------------
    const newCreatorToken = (admin, name, symbol, xname, xsymbol, root) => registry.createToken(admin, name, symbol, xname, xsymbol, root)
        .then(tx => tx.wait())
        .then(receipt => receipt.events.find(({ event }) => event === 'Transfer'))
        .then(event => event.args.tokenId)
        .then(tokenId => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.zeroPad(tokenId, 20))))
        .then(address => attach('P00lsTokenCreator', address));

    const getXCreatorToken = (creatorToken) => creatorToken.xCreatorToken()
        .then(address => attach('P00lsTokenXCreator', address));

    // ------ Deploy p00ls token -------------------------------------------------------------------------------------
    const token = isEnabled('token') && await manager.cache.get('token')
        .then(address => !opts.noCache && address
            ? attach('P00lsTokenCreator', address)
            : newCreatorToken(
                signer.address,
                config.contracts.token.name,
                config.contracts.token.symbol,
                config.contracts.token.xname,
                config.contracts.token.xsymbol,
                config.contracts.token.merkleroot,
            ).then(instance => manager.cache.set('token', instance.address).then(_ => instance))
        );

    const xToken = isEnabled('token') && await getXCreatorToken(token);

    // ------ Upgrade p00ls token ------------------------------------------------------------------------------------
    const tokenXCreatorV2 = isEnabled('registry') && registry && await manager.migrate(
        'tokenXCreatorV2',
        getFactory('P00lsTokenXCreator_V2', { signer }),
        [
            escrow.address,
        ],
        { ...opts, noConfirm: true },
    );

    // tokenCreator && await Promise.all([
    //     registry.beaconCreator(),
    //     getFactory('P00lsTokenCreator', { signer }),
    // ]).then(([ beacon, factory ]) => upgrades.forceImport(beacon, factory, { constructorArgs: [ registry.address ] }));

    // tokenXCreator && await Promise.all([
    //     registry.beaconXCreator(),
    //     getFactory('P00lsTokenXCreator', { signer }),
    // ]).then(([ beacon, factory ]) => upgrades.forceImport(beacon, factory, { constructorArgs: [ escrow.address ] }));

    // tokenXCreator && await Promise.all([
    //     registry.beaconXCreator(),
    //     getFactory('P00lsTokenXCreator_V2', { signer }),
    // ]).then(([ beacon, factory ]) => upgrades.prepareUpgrade(beacon, factory, { constructorArgs: [ escrow.address ], unsafeAllow: 'delegatecall' }));

    isEnabled('registry') && await registry.beaconXCreator()
        .then(address => attach('Beacon', address))
        .then(beacon => beacon.implementation())
        .then(implementation => implementation == tokenXCreatorV2.address || registry.upgradeXCreatorToken(tokenXCreatorV2.address).then(tx => tx.wait()));

    const getXCreatorTokenV2 = (creatorToken) => creatorToken.xCreatorToken()
        .then(address => attach('P00lsTokenXCreator_V2', address));

    const xTokenV2 = isEnabled('token') && await getXCreatorTokenV2(token);

    // ------ Upgrade p00ls registry ---------------------------------------------------------------------------------
    const registryV2 = await getFactory('P00lsCreatorRegistry_V2', { signer }).then(factory => upgrades.upgradeProxy(registry, factory));

    /*******************************************************************************************************************
     *                                                       DAO                                                       *
     *******************************************************************************************************************/
     const timelock = isEnabled('governance') && await manager.migrate(
        'timelock',
        getFactory('P00lsTimelock', { signer }),
        [
            config.contracts.governance.timelockMinDelay,
            [],
            [],
        ],
        { ...opts },
    );

    const dao = isEnabled('governance') && timelock && await manager.migrate(
        'dao',
        getFactory('P00lsDAO', { signer }),
        [
            token.address,
            timelock.address,
        ],
        { ...opts,  kind: 'uups' },
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

    const feemanager = isEnabled('amm') && router && token && xToken && await manager.migrate(
        'feemanager',
        getFactory('FeeManager', { signer }),
        [
            signer.address,
            router.address,
            token.address,
            xToken.address,
            ethers.utils.parseEther('.8'),
        ],
        { ...opts },
    );

    const auction = isEnabled('auction') && router && token && timelock && await manager.migrate(
        'auction',
        getFactory('AuctionFactory', { signer }),
        [
            signer.address,
            router.address,
            token.address,
            timelock.address,
        ],
        { ...opts },
    );

    /*******************************************************************************************************************
     *                                                     Locking                                                     *
     *******************************************************************************************************************/
    const locking = isEnabled('locking') && router && await manager.migrate(
        'locking',
        getFactory('Locking', { signer }),
        [
            signer.address,
            router.address,
            token.address,
        ],
        { ...opts },
    );

    /*******************************************************************************************************************
     *                                             Post deployment config                                              *
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
        WHITELISTER:      ethers.utils.id('WHITELISTER'),
        WHITELISTED:      ethers.utils.id('WHITELISTED'),
    }).map(entry => Promise.all(entry))).then(Object.fromEntries);

    // Transfer ownership of the registry
    isEnabled('governance', 'registry'          ) && await registry.hasRole     (roles.UPGRADER,      timelock.address).then(yes => yes || registry.grantRole   (roles.UPGRADER,      timelock.address).then(tx => tx.wait()));
    isEnabled('governance', 'registry'          ) && await registry.hasRole     (roles.UPGRADER,      signer.address  ).then(yes => yes && registry.renounceRole(roles.UPGRADER,      signer.address  ).then(tx => tx.wait()));
    isEnabled('governance', 'registry'          ) && await registry.ownerOf(registry.address).then(owner => owner == timelock.address || registry.transferFrom(owner, timelock.address, registry.address));
    // Set fees and factory roles
    isEnabled('governance', 'amm'               ) && await factory.feeTo().then(address => address == feemanager.address || factory.setFeeTo(feemanager.address).then(tx => tx.wait()));
    isEnabled('governance', 'amm', 'auction'    ) && await factory.hasRole      (roles.PAIR_CREATOR,  auction.address ).then(yes => yes || factory.grantRole    (roles.PAIR_CREATOR,  auction.address ).then(tx => tx.wait()));
    isEnabled('governance', 'amm'               ) && await factory.hasRole      (roles.DEFAULT_ADMIN, timelock.address).then(yes => yes || factory.grantRole    (roles.DEFAULT_ADMIN, timelock.address).then(tx => tx.wait()));
    isEnabled('governance', 'amm'               ) && await factory.hasRole      (roles.DEFAULT_ADMIN, signer.address  ).then(yes => yes && factory.renounceRole (roles.DEFAULT_ADMIN, signer.address  ).then(tx => tx.wait()));
    // Transfer control of the vesting factory
    isEnabled('governance', 'vesting'           ) && await vestedAirdrop.hasRole(roles.DEFAULT_ADMIN, timelock.address).then(yes => yes || vestedAirdrop.grantRole    (roles.DEFAULT_ADMIN, timelock.address).then(tx => tx.wait()));
    isEnabled('governance', 'vesting'           ) && await vestedAirdrop.hasRole(roles.DEFAULT_ADMIN, signer.address  ).then(yes => yes && vestedAirdrop.renounceRole (roles.DEFAULT_ADMIN, signer.address  ).then(tx => tx.wait()));
    // Transfer control of the auction factory
    isEnabled('governance', 'auction'           ) && await auction.hasRole      (roles.DEFAULT_ADMIN, timelock.address).then(yes => yes || auction.grantRole    (roles.DEFAULT_ADMIN, timelock.address).then(tx => tx.wait()));
    isEnabled('governance', 'auction'           ) && await auction.hasRole      (roles.DEFAULT_ADMIN, signer.address  ).then(yes => yes && auction.renounceRole (roles.DEFAULT_ADMIN, signer.address  ).then(tx => tx.wait()));
    // Transfer control of the escrow
    isEnabled('governance', 'escrow'            ) && await escrow.hasRole       (roles.DEFAULT_ADMIN, timelock.address).then(yes => yes || escrow.grantRole     (roles.DEFAULT_ADMIN, timelock.address).then(tx => tx.wait()));
    isEnabled('governance', 'escrow'            ) && await escrow.hasRole       (roles.DEFAULT_ADMIN, signer.address  ).then(yes => yes && escrow.renounceRole  (roles.DEFAULT_ADMIN, signer.address  ).then(tx => tx.wait()));
    // Transfer control of the locking
    isEnabled('governance', 'locking'           ) && await locking.hasRole      (roles.DEFAULT_ADMIN, timelock.address).then(yes => yes || locking.grantRole    (roles.DEFAULT_ADMIN, timelock.address).then(tx => tx.wait()));
    isEnabled('governance', 'locking'           ) && await locking.hasRole      (roles.DEFAULT_ADMIN, signer.address  ).then(yes => yes && locking.renounceRole (roles.DEFAULT_ADMIN, signer.address  ).then(tx => tx.wait()));

    weth           && DEBUG(`WETH:           ${weth.address          }`);
    multicall      && DEBUG(`Multicall:      ${multicall.address     }`);
    timelock       && DEBUG(`Timelock:       ${timelock.address      }`);
    dao            && DEBUG(`Dao:            ${dao.address           }`);
    vestedAirdrop  && DEBUG(`VestedAirdrop:  ${vestedAirdrop.address }`);
    vestingFactory && DEBUG(`VestingFactory: ${vestingFactory.address}`);
    escrow         && DEBUG(`Escrow:         ${escrow.address        }`);
    registry       && DEBUG(`Registry:       ${registry.address      }`);
    token          && DEBUG(`Token:          ${token.address         }`);
    xToken         && DEBUG(`xToken:         ${xToken.address        }`);
    factory        && DEBUG(`Factory:        ${factory.address       }`);
    router         && DEBUG(`Router:         ${router.address        }`);
    feemanager     && DEBUG(`FeeManager:     ${feemanager.address    }`);
    auction        && DEBUG(`Auction:        ${auction.address       }`);
    locking        && DEBUG(`Locking:        ${locking.address       }`);

    return {
        config,
        roles,
        contracts: {
            weth,
            multicall,
            timelock,
            dao,
            vestedAirdrop,
            vestingFactory,
            escrow,
            registry: registryV2,
            token,
            xToken: xTokenV2,
            factory,
            router,
            feemanager,
            auction,
            locking,
        },
        workflows: {
            newCreatorToken,
            getXCreatorToken: getXCreatorTokenV2,
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