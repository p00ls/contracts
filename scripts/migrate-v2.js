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

    // ------ Creator registry ---------------------------------------------------------------------------------------
    const registry = isEnabled('registryV2') && await manager.migrate(
        'registryV2',
        getFactory('P00lsV2Registry', { signer }),
        [
            signer.address,
            config.contracts.registry.name,
            config.contracts.registry.symbol,
        ],
        { ...opts, kind: 'uups', unsafeAllow: 'delegatecall' },
    );

    // ------ Token templates ----------------------------------------------------------------------------------------
    const tokenImpl = isEnabled('registryV2') && registry && await manager.migrate(
        'tokenV2',
        getFactory('P00lsV2Token', { signer }),
        [
            registry.address,
        ],
        { ...opts, noConfirm: true },
    );

    // ------ Setup beacons ------------------------------------------------------------------------------------------
    isEnabled('registryV2') && await registry.implementation()
        .then(implementation => implementation == tokenImpl.address || registry.upgradeTokens(tokenImpl.address).then(tx => tx.wait()));

    // ------ Tooling ------------------------------------------------------------------------------------------------
    const newToken = (admin, name, symbol, root, deterministic = false) => registry[deterministic ? 'createToken2' : 'createToken'](admin, name, symbol, root)
        .then(tx => tx.wait())
        .then(receipt => receipt.events.find(({ event }) => event === 'Transfer'))
        .then(event => event.args.tokenId)
        .then(tokenId => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.zeroPad(tokenId, 20))))
        .then(address => attach('P00lsV2Token', address));

    registry  && DEBUG(`[V2] Registry:   ${registry.address  }`);
    tokenImpl && DEBUG(`[V2] Token Impl: ${tokenImpl.address }`);

    const roles = await Promise.all(Object.entries({
        DEFAULT_ADMIN:    ethers.constants.HashZero,
        REGISTRY_MANAGER: ethers.utils.id('REGISTRY_MANAGER_ROLE'),
        UPGRADER:         ethers.utils.id('UPGRADER_ROLE'),
        WHITELISTER:      ethers.utils.id('WHITELISTER'),
        WHITELISTED:      ethers.utils.id('WHITELISTED'),
    }).map(entry => Promise.all(entry))).then(Object.fromEntries);

    return {
        config,
        roles,
        contracts: {
            registry,
            tokenImpl,
        },
        workflows: {
            newToken,
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