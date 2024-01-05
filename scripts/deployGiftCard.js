const { ethers } = require('hardhat');
const { MigrationManager, getFactory } = require('@amxx/hre/scripts');
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

    // Deploy the giftcards
    for (const [ key, details ] of Object.entries(config?.contracts?.giftcards ?? {})) {
        const name        = details.name ?? key;
        const symbol      = details.symbol; // throw if absent ?
        const owner       = details.owner;
        const beneficiary = details.beneficiary ?? details.owner;
        const uri         = details.uri;
        const mintFee     = details.mintFee;

        const instance = await manager.migrate(
            `giftcard-${symbol}`,
            getFactory('GiftCardRegistry', { signer }),
            [ name, symbol ],
            { ...opts },
        );

        if (signer.address == await instance.owner()) {
            const operations = [];
            if (uri) {
                operations.push({ fn: 'setBaseURI', args: [uri] });
            }
            if (mintFee && mintFee != await instance.mintFee()) {
                operations.push({ fn: 'setMintFee', args: [mintFee] });
            }
            if (beneficiary && beneficiary != await instance.beneficiary()) {
                operations.push({ fn: 'setBeneficiary', args: [beneficiary] });
            }
            if (owner && owner !== await instance.owner()) {
                operations.push(
                    owner == ethers.constants.AddressZero
                    ? { fn: 'renounceOwnership' }
                    : { fn: 'transferOwnership', args: [owner] }
                );
            }
            await instance.multicall(operations.map(op => instance.interface.encodeFunctionData(op.fn, op.args ?? [])));
        }
    }
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