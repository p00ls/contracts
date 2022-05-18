const { upgrades                             } = require('hardhat');
const { MigrationManager, getFactory, attach } = require('@amxx/hre/scripts');
const DEBUG  = require('debug')('p00ls');
const merkle = require('../scripts/utils/merkle');

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
     *                                                     Vesting                                                     *
     *******************************************************************************************************************/
    const vesting = await manager.migrate(
        'vesting',
        getFactory('VestedAirdrops', { signer }),
        [
            config.admin,
        ],
        { ...opts },
    );

    DEBUG(`- vesting deployed       ${vesting.address}`);

    /*******************************************************************************************************************
     *                                                  P00ls creator                                                  *
     *******************************************************************************************************************/
    const escrow = await manager.migrate(
        'escrow',
        getFactory('Escrow', { signer }),
        [
            config.admin,
        ],
        { ...opts },
    );

    DEBUG(`- escrow deployed        ${escrow.address}`);

    // ------ Creator registry ---------------------------------------------------------------------------------------
    const registry = await manager.migrate(
        'registry',
        getFactory('P00lsCreatorRegistry', { signer }),
        [
            signer.address, // don't use admin here, we'll transfer the right later
            config.contracts.registry.name,
            config.contracts.registry.symbol,
        ],
        { ...opts, kind: 'uups', unsafeAllow: 'delegatecall' },
    );

    DEBUG(`- registry deployed      ${registry.address}`);

    // ------ Token templates ----------------------------------------------------------------------------------------
    const tokenCreator = await manager.migrate(
        'tokenCreator',
        getFactory('P00lsTokenCreator', { signer }),
        [
            registry.address,
        ],
        { ...opts },
    );

    DEBUG(`- tokenCreator deployed  ${tokenCreator.address}`);

    const tokenXCreator = await manager.migrate(
        'tokenXCreator',
        getFactory('P00lsTokenXCreator', { signer }),
        [
            escrow.address,
        ],
        { ...opts },
    );

    DEBUG(`- tokenXCreator deployed ${tokenXCreator.address}`);

    // ------ Setup beacons ------------------------------------------------------------------------------------------
    await registry.multicall([
        registry.interface.encodeFunctionData('upgradeCreatorToken',  [ tokenCreator.address  ]),
        registry.interface.encodeFunctionData('upgradeXCreatorToken', [ tokenXCreator.address ]),
    ]).then(tx => tx.wait());

    DEBUG(`- beacon setup`);

    await upgrades.forceImport(await registry.beaconCreator(),  await getFactory('P00lsTokenCreator' ), { constructorArgs: [ registry.address ]});
    await upgrades.forceImport(await registry.beaconXCreator(), await getFactory('P00lsTokenXCreator'), { constructorArgs: [ escrow.address   ]});

    DEBUG(`- manifest filled`);

    // ------ Tooling ------------------------------------------------------------------------------------------------
    const newCreatorToken = (admin, name, symbol, xname, xsymbol, root) => registry.createToken(admin, name, symbol, xname, xsymbol, root)
        .then(tx => tx.wait())
        .then(receipt => receipt.events.find(({ event }) => event === 'Transfer'))
        .then(event => event.args.tokenId)
        .then(tokenId => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.zeroPad(tokenId, 20))))
        .then(address => attach('P00lsTokenCreator', address));

    // ------ Deploy p00ls token -------------------------------------------------------------------------------------
    const allocations = [
        { index: 0, account: config.admin,    amount: ethers.utils.parseEther("850000000") },
        { index: 1, account: vesting.address, amount: ethers.utils.parseEther("150000000") },
    ];

    const merkletree = merkle.createMerkleTree(allocations.map(merkle.hashAllocation));

    const token = await manager.cache.get('token')
        .then(address => !opts.noCache && address
        ? attach('P00lsTokenCreator', address)
        : newCreatorToken(
            config.admin,
            config.contracts.token.name,
            config.contracts.token.symbol,
            config.contracts.token.xname,
            config.contracts.token.xsymbol,
            merkletree.getHexRoot(),
        ).then(instance => manager.cache.set('token', instance.address).then(_ => instance))
    );

    DEBUG(`- p00ls deployed         ${token.address}`);

    await token.multicall(
        allocations.map(allocation => token.interface.encodeFunctionData(
            'claim',
            [
                allocation.index,
                allocation.account,
                allocation.amount,
                merkletree.getHexProof(merkle.hashAllocation(allocation))
            ],
        ))
    ).then(tx => tx.wait());

    DEBUG(`- allocations claimed`);

    // ------ Renounce roles -----------------------------------------------------------------------------------------
    await registry.hasRole(roles.UPGRADER,         signer.address).then(yes   => yes                   && registry.renounceRole(roles.UPGRADER,         signer.address).then(tx => tx.wait()));
    await registry.hasRole(roles.REGISTRY_MANAGER, signer.address).then(yes   => yes                   && registry.renounceRole(roles.REGISTRY_MANAGER, signer.address).then(tx => tx.wait()));
    await registry.ownerOf(registry.address                      ).then(owner => owner == config.admin || registry.transferFrom(owner, config.admin, registry.address ).then(tx => tx.wait()));

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