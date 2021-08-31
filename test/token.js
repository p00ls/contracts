const { ethers } = require('hardhat');
const { expect } = require('chai');

const { migrate, CONFIG } = require('../scripts/migrate.js');

describe('Main', function () {
  before(async function () {
    await migrate().then(env => Object.assign(this, env));
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
  });
});
