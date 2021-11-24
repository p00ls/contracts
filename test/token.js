const { ethers } = require('hardhat');
const { expect } = require('chai');

const { migrate, CONFIG } = require('../scripts/migrate.js');

describe('$00 Token', function () {
  before(async function () {
    await migrate().then(env => Object.assign(this, env));
    __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
  });

  beforeEach(async function() {
    await ethers.provider.send('evm_revert', [ __SNAPSHOT_ID__ ])
    __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
  });

  it('Check social token', async function () {
    expect(await this.token.name())
      .to.be.equal('P00ls token');
    expect(await this.token.symbol())
      .to.be.equal('$00');
    expect(await this.token.owner())
      .to.be.equal(this.accounts.admin.address);
    expect(await this.registry.ownerOf(this.token.address))
      .to.be.equal(this.accounts.admin.address);
    expect(await this.registry.tokenURI(this.token.address))
      .to.be.equal(`${CONFIG.registry.baseuri}${ethers.BigNumber.from(this.token.address).toString()}`);

    expect(await this.xToken.name())
      .to.be.equal('xP00ls token');
    expect(await this.xToken.symbol())
      .to.be.equal('x$00');
    expect(await this.xToken.owner())
      .to.be.equal(this.accounts.admin.address);
  });
});
