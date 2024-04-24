const {
    attach,
    deploy,
    deployUpgradeable,
    performUpgrade,
} = require('@amxx/hre/scripts');

const migrate   = require('../scripts/migrateAll');
const migrateV2 = require('../scripts/migrate-v2');
const merkle    = require('../scripts/utils/merkle');
const CONFIG    = require('../scripts/config');

function prepare() {
    before(async function () {
        // migrate v1
        await migrate(CONFIG).then(context => Object.assign(this, context, context.contracts));
        this.accounts.admin = this.accounts.shift();
        // migrate v2
        this.v2 = {};
        await migrateV2(this.config).then(context => Object.assign(this.v2, context, context.contracts));
        await this.v2.registry.setBaseURI(this.config.contracts.registry.baseuri);
        // snapshot
        __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
    });

    beforeEach(async function() {
        await ethers.provider.send('evm_revert', [ __SNAPSHOT_ID__ ])
        __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
    });
}

module.exports = {
    prepare,
    CONFIG,
    utils: {
        attach,
        deploy,
        deployUpgradeable,
        performUpgrade,
        merkle,
    }
};