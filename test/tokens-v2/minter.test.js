const { ethers } = require('hardhat');
const { expect } = require('chai');

const { prepare } = require('../fixture.js');
const { getDomain, CreateToken } = require('../helpers/eip712.js');

const packFees = (recipient, amount) => ethers.BigNumber.from(recipient.address ?? recipient).shl(96).add(amount);

describe('Create token through mint relay', function () {
  prepare();

  before(async function () {
    this.accounts.minter    = this.accounts.shift();
    this.accounts.artist    = this.accounts.shift();
    this.accounts.recipient = this.accounts.shift();
    this.accounts.other     = this.accounts.shift();
  });

  beforeEach(async function () {
    this.domain = await getDomain(this.v2.mintRelay);

    // give signature permission
    await this.v2.mintRelay.grantRole(this.v2.roles.MINTER, this.accounts.minter.address);
  });

  it('sanity', async function () {
    expect(await this.v2.registry.hasRole(this.v2.roles.REGISTRY_MANAGER, this.v2.contracts.mintRelay.address)).to.be.true;
    expect(await this.v2.registry.hasRole(this.v2.roles.REGISTRY_MANAGER, this.accounts.minter.address)).to.be.false;
    expect(await this.v2.registry.hasRole(this.v2.roles.REGISTRY_MANAGER, this.accounts.artist.address)).to.be.false;
    expect(await this.v2.registry.hasRole(this.v2.roles.REGISTRY_MANAGER, this.accounts.other.address)).to.be.false;
  });

  it('create using signature', async function () {
    const owner     = this.accounts.artist.address;
    const name      = 'Some Token';
    const symbol    = 'ST';
    const root      = ethers.utils.randomBytes(32);
    const fees      = ethers.constants.HashZero;
    const signature = await this.accounts.minter._signTypedData(
        this.domain,
        { CreateToken },
        { owner, name, symbol, root, fees },
    );

    const predicted = await this.v2.registry.predictToken2(name, symbol, root);

    await expect(this.v2.mintRelay.connect(this.accounts.other).createToken(owner, name, symbol, root, fees, signature))
        .to.emit(this.v2.registry, 'Transfer').withArgs(ethers.constants.AddressZero, this.accounts.artist.address, predicted);
  });

  it('replay', async function () {
    const owner     = this.accounts.artist.address;
    const name      = 'Some Token';
    const symbol    = 'ST';
    const root      = ethers.utils.randomBytes(32);
    const fees      = ethers.constants.HashZero;
    const signature = await this.accounts.minter._signTypedData(
        this.domain,
        { CreateToken },
        { owner, name, symbol, root, fees },
    );

    // once
    await expect(this.v2.mintRelay.connect(this.accounts.other).createToken(owner, name, symbol, root, fees, signature))
        .to.be.not.reverted;

    // replay
    await expect(this.v2.mintRelay.connect(this.accounts.other).createToken(owner, name, symbol, root, fees, signature))
        .to.be.reverted;
  });

  it('unauthorized', async function () {
    const owner     = this.accounts.artist.address;
    const name      = 'Some Token';
    const symbol    = 'ST';
    const root      = ethers.utils.randomBytes(32);
    const fees      = ethers.constants.HashZero;
    const signature = await this.accounts.other._signTypedData(
        this.domain,
        { CreateToken },
        { owner, name, symbol, root, fees },
    );

    await expect(this.v2.mintRelay.connect(this.accounts.other).createToken(owner, name, symbol, root, fees, signature))
        .to.be.revertedWith(`AccessControlUnauthorizedAccount("${this.accounts.other.address}", "${this.v2.roles.MINTER}")`);
  });

  it('with fees', async function () {
    const owner     = this.accounts.artist.address;
    const name      = 'Some Token';
    const symbol    = 'ST';
    const root      = ethers.utils.randomBytes(32);
    const feeAmount = ethers.utils.parseEther('3.14159');
    const fees      = packFees(this.accounts.recipient.address, feeAmount);

    const signature = await this.accounts.minter._signTypedData(
        this.domain,
        { CreateToken },
        { owner, name, symbol, root, fees },
    );

    // without value
    await expect(this.v2.mintRelay.connect(this.accounts.other).createToken(owner, name, symbol, root, fees, signature))
        .to.be.revertedWith('Invalid payment');

    // without wrong value
    await expect(this.v2.mintRelay.connect(this.accounts.other).createToken(owner, name, symbol, root, fees, signature, { value: feeAmount.sub(1) }))
        .to.be.revertedWith('Invalid payment');

    // with correct value
    await expect(() => this.v2.mintRelay.connect(this.accounts.other).createToken(owner, name, symbol, root, fees, signature, { value: feeAmount }))
        .to.changeEtherBalances([ this.accounts.other, this.accounts.recipient ], [ feeAmount.mul(-1), feeAmount]);
  });
});
