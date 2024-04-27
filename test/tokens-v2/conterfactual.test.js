const { ethers } = require('hardhat');
const { expect } = require('chai');

const { prepare } = require('../fixture.js');

describe('Create token conterfactualy', function () {
  prepare();

  before(async function () {
    this.accounts.reserve = this.accounts.shift();
    this.accounts.artist  = this.accounts.shift();
    this.accounts.user    = this.accounts.shift();
    this.accounts.other   = this.accounts.shift();
  });

  it('predict & create', async function () {
    const name    = 'Some Token';
    const symbol  = 'ST';
    const root    = ethers.utils.randomBytes(32);

    const predicted = await this.v2.registry.predictToken2(name, symbol, root);

    await expect(this.v2.registry.createToken2(this.accounts.artist.address, name, symbol, root))
      .to.emit(this.v2.registry, 'Transfer').withArgs(ethers.constants.AddressZero, this.accounts.artist.address, predicted);
  });
});
