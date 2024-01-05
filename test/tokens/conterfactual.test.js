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
    const xname   = 'X Some Token';
    const xsymbol = 'xST';
    const root    = ethers.utils.randomBytes(32);


    const predicted = await this.registry.predictToken2(name, symbol, xname, xsymbol, root);

    expect(await this.registry.createToken2(this.accounts.artist.address, name, symbol, xname, xsymbol, root))
    .to.emit(this.registry, 'Transfer').withArgs(ethers.constants.AddressZero, this.accounts.artist.address, predicted);
  });

});
