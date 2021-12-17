const migrate = require('../scripts/migrate.js');
const CONFIG = require('./config');

function prepare() {
    before(async function () {
        await migrate.migrate(CONFIG).then(env => Object.assign(this, env));
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
    ...migrate,
};