require('dotenv').config();

const { MigrationManager, getFactory, attach } = require('@amxx/hre/scripts');
const DEBUG  = require('debug')('p00ls');
const matic  = require('@maticnetwork/fx-portal/config/config');
const config = require('./config');


const argv = require('yargs/yargs')(process.argv.slice(2))
  .env('')
  .options({
    network:  { type: 'string' , options: [ 'mainnet', 'testnet' ], default: 'testnet' },
    mnemonic: { type: 'string' },
  })
  .argv;


(async () => {
    const chains = await Promise.all(
        [ 'mainnet', 'goerli', 'matic', 'mumbai' ]
        .map(name => argv[`${name}Node`])
        .map(node => ethers.getDefaultProvider(node))
        .map(node => node.getNetwork().then(network => [ network.chainId, node ]))
    ).then(Object.fromEntries);

    const signer = ethers.Wallet.fromMnemonic(argv.mnemonic);
    const L1     = signer.connect(chains[argv.network == 'mainnet' ? 1   : 5    ]);
    const L2     = signer.connect(chains[argv.network == 'mainnet' ? 137 : 80001]);
    L1.manager   = new MigrationManager(L1.provider);
    L2.manager   = new MigrationManager(L2.provider);

    const { fxRoot, fxChild, checkpointManager } = matic[argv.network];
    const L1registry = await L1.manager.cacheAsPromise.then(cache => cache.get('registry'));

    const opts = { noCache: false, noConfirm: false };

    DEBUG(`=== config ===`);
    DEBUG(`signer:  ${signer.address}`);
    DEBUG(`L1: ${L1.provider.network.name} (${L1.provider.network.chainId})`);
    DEBUG(`L2: ${L2.provider.network.name} (${L2.provider.network.chainId})`);
    DEBUG(`=== start ===`);

    /*******************************************************************************************************************
     *                                                    SIDECHAIN                                                    *
     *******************************************************************************************************************/
    const escrow = await L2.manager.migrate(
        'escrow',
        getFactory('Escrow', { signer: L2 }),
        [
            signer.address,
        ],
        { ...opts },
    );
    DEBUG(`Escrow:     ${escrow.address  }`);

    // ------ Creator registry ---------------------------------------------------------------------------------------
    const registry = await L2.manager.migrate(
        'registry',
        getFactory('P00lsCreatorRegistry_Polygon', { signer: L2 }),
        [
            signer.address,
            config.contracts.registry.name,
            config.contracts.registry.symbol,
        ],
        { ...opts, kind: 'uups', constructorArgs: [ fxChild.address ]},
    );
    DEBUG(`Registry:   ${registry.address}`);
    DEBUG(`- beacon:   ${await registry.beaconCreator()}`);
    DEBUG(`- xbeacon:  ${await registry.beaconXCreator()}`);

    // ------ Token templates ----------------------------------------------------------------------------------------
    const tokenCreator = await L2.manager.migrate(
        'tokenCreator',
        getFactory('P00lsTokenCreator_Polygon', { signer: L2 }),
        [
            registry.address,
        ],
        { ...opts },
    );
    DEBUG(`- creator:  ${tokenCreator.address}`);

    const tokenXCreator = await L2.manager.migrate(
        'tokenXCreatorV2',
        getFactory('P00lsTokenXCreator', { signer: L2 }),
        [
            escrow.address,
        ],
        { ...opts },
    );
    DEBUG(`- xcreator: ${tokenXCreator.address}`);

    // ------ Setup beacons ------------------------------------------------------------------------------------------
    await registry.beaconCreator()
        .then(address => attach('Beacon', address))
        .then(beacon => beacon.implementation())
        .then(implementation => implementation == tokenCreator.address || registry.upgradeCreatorToken(tokenCreator.address).then(tx => tx.wait()));

    await registry.beaconXCreator()
        .then(address => attach('Beacon', address))
        .then(beacon => beacon.implementation())
        .then(implementation => implementation == tokenXCreator.address || registry.upgradeXCreatorToken(tokenXCreator.address).then(tx => tx.wait()));

    /*******************************************************************************************************************
     *                                                     MAINNET                                                     *
     *******************************************************************************************************************/
    const bridge = await L1.manager.migrate(
        'bridge-matic',
        getFactory('P00lsBridgePolygon', { signer: L1 }),
        [
            checkpointManager.address,
            fxRoot.address,
            L1registry,
        ],
        { ...opts },
    )
    DEBUG(`Bridge:     ${bridge.address  }`);

    /*******************************************************************************************************************
     *                                                      LINK                                                       *
     *******************************************************************************************************************/
    await registry.setFxRootTunnel(bridge.address);
    await bridge.setFxChildTunnel(registry.address);

    DEBUG(`=== end ===`);

})().catch(console.error);
