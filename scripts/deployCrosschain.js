const { MigrationManager, getFactory, attach } = require('@amxx/hre/scripts');
const DEBUG  = require('debug')('p00ls');
const matic  = require('@maticnetwork/fx-portal/config/config');

require('dotenv').config();
const argv = require('yargs/yargs')(process.argv.slice(2)).env('').argv;


async function migrate(config = {}, env = {})
{
    const signer  = env.signer   || await ethers.getSigner();
    const network = await ethers.provider.getNetwork();
    const chains  = {};
    const opts    = {};

    switch (network.chainId) {
        // matic
        case 137:
            chains.L1 = ethers.Wallet.fromMnemonic(argv.mnemonic).connect(ethers.getDefaultProvider(argv.mainnetNode));
            chains.L2 = signer;
            config.matic = matic.mainnet;
            break;
        // mumbai
        case 80001:
            chains.L1 = ethers.Wallet.fromMnemonic(argv.mnemonic).connect(ethers.getDefaultProvider(argv.goerliNode));
            chains.L2 = signer;
            config.matic = matic.testnet;
            break;
        case 80002:
            chains.L1 = ethers.Wallet.fromMnemonic(argv.mnemonic).connect(ethers.getDefaultProvider(argv.sepoliaNode));
            chains.L2 = signer;
            config.matic = { 
                fxChild: {
                    address: "0xE5930336866d0388f0f745A2d9207C7781047C0f"
                },
                checkpointManager: {
                    address: "0xbd07D7E1E93c8d4b2a261327F3C28a8EA7167209"
                },
                fxRoot: {
                    address: "0x0E13EBEdDb8cf9f5987512d5E081FdC2F5b0991e"
                }
            };
            break;
        // local testnet
        case 1337:
        case 31337:
            chains.L1 = signer;
            chains.L2 = signer;
            opts.noCache = true;
            break;
        default:
            throw new Error(`Unsuported network: ${network.name} (${network.chainId})`);
    }
    const { L1, L2 } = chains;
    L1.manager = new MigrationManager(L1.provider);
    L2.manager = new MigrationManager(L2.provider);

    const L1registry = await L1.manager.cacheAsPromise.then(cache => cache.get('registry'));

    DEBUG(`=== config ===`);
    DEBUG(`L1: ${L1.provider.network.name} (${L1.provider.network.chainId}) - ${L1.address}`);
    DEBUG(`L2: ${L2.provider.network.name} (${L2.provider.network.chainId}) - ${L2.address}`);
    DEBUG(`=== start ===`);

    /*******************************************************************************************************************
     *                                                    SIDECHAIN                                                    *
     *******************************************************************************************************************/
    const escrow = await L2.manager.migrate(
        'matic-escrow',
        getFactory('Escrow', { signer: L2 }),
        [
            L2.address,
        ],
        { ...opts },
    );
    DEBUG(`Escrow:     ${escrow.address  }`);

    // ------ Creator registry ---------------------------------------------------------------------------------------
    const registry = await L2.manager.migrate(
        'matic-registry',
        getFactory('P00lsCreatorRegistry_Polygon', { signer: L2 }),
        [
            L2.address,
            config.contracts.registry.name,
            config.contracts.registry.symbol,
        ],
        { ...opts, kind: 'uups', constructorArgs: [ config.matic?.fxChild.address || ethers.constants.AddressZero ]},
    );
    DEBUG(`Registry:   ${registry.address}`);
    DEBUG(`- beacon:   ${await registry.beaconCreator()}`);
    DEBUG(`- xbeacon:  ${await registry.beaconXCreator()}`);

    // ------ Token templates ----------------------------------------------------------------------------------------
    const tokenCreator = await L2.manager.migrate(
        'matic-tokenCreator',
        getFactory('P00lsTokenCreator_Polygon', { signer: L2 }),
        [
            registry.address,
        ],
        { ...opts },
    );
    DEBUG(`- creator:  ${tokenCreator.address}`);

    const tokenXCreator = await L2.manager.migrate(
        'matic-tokenXCreatorV2',
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
        'matic-bridge',
        getFactory('P00lsBridgePolygon', { signer: L1 }),
        [
            config.matic?.checkpointManager.address || ethers.constants.AddressZero,
            config.matic?.fxRoot.address            || ethers.constants.AddressZero,
            L1registry                              || ethers.constants.AddressZero,
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