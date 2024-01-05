const {
    attach,
    deploy,
    deployUpgradeable,
    performUpgrade,
} = require('@amxx/hre/scripts');

const migrate = require('../scripts/migrateAll');
const merkle  = require('../scripts/utils/merkle');
const CONFIG  = require('../scripts/config');

function prepare() {
    before(async function () {
        await migrate(CONFIG).then(context => Object.assign(this, context, context.contracts));
        this.accounts.admin = this.accounts.shift();
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