const migrate = require('../scripts/migrate.js');

function prepare() {
    before(async function () {
        await migrate.migrate().then(env => Object.assign(this, env));
        __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
    });

    beforeEach(async function() {
        await ethers.provider.send('evm_revert', [ __SNAPSHOT_ID__ ])
        __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
    });
}

module.exports = {
    prepare,
    ...migrate,
};