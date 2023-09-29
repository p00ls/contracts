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
    const salt = ethers.utils.randomBytes(32);

    const predicted = await this.registry.predictToken2(salt);

    expect(await this.registry.createToken2(
      this.accounts.artist.address, // admin
      'Some Token',                 // name
      'ST',                         // symbol
      'X Some Token',               // xname
      'xST',                        // xsymbol
      ethers.constants.HashZero,    // root
      salt,
    ))
    .to.emit(this.registry, 'Transfer').withArgs(ethers.constants.AddressZero, this.accounts.artist.address, predicted);
  });

});
