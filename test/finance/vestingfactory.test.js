const { ethers } = require('hardhat');
const { expect } = require('chai');

const { prepare, utils } = require('../fixture.js');

const value           = ethers.utils.parseEther('1');
const cliffDuration   = 7200;  // one hour
const vestingDuration = 86400; // one day

describe('Vesting factory', function () {
  prepare();

  before(async function () {
    this.accounts.user1 = this.accounts.shift();
    this.accounts.user2 = this.accounts.shift();
    this.accounts.user3 = this.accounts.shift();
  });

  beforeEach(async function () {
    this.now = await ethers.provider.getBlock().then(({ timestamp }) => timestamp + 10); // leave some gap

    this.instance = await this.vestingFactory.newVesting(this.accounts.user1.address, this.now, cliffDuration, vestingDuration)
      .then(tx => tx.wait())
      .then(receipt => receipt.events.find(({ event }) => event === 'Transfer'))
      .then(event => event.args.tokenId)
      .then(tokenId => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.zeroPad(tokenId, 20))))
      .then(address => utils.attach('VestingTemplate', address));
  });

  it('create vesting', async function () {
    expect(await this.instance.owner()).to.be.equal(this.accounts.user1.address);
    expect(await this.instance.beneficiary()).to.be.equal(this.accounts.user1.address);
    expect(await this.instance.start()).to.be.equal(this.now);
    expect(await this.instance.cliff()).to.be.equal(this.now + cliffDuration);
    expect(await this.instance.duration()).to.be.equal(vestingDuration);
  });

  describe('can be transfered', function () {
    it('at the registry', async function () {
      expect(await this.vestingFactory.connect(this.accounts.user1).transferFrom(this.accounts.user1.address, this.accounts.user2.address, this.instance.address))
      .to.emit(this.vestingFactory, 'Transfer').withArgs(this.accounts.user1.address, this.accounts.user2.address, this.instance.address);
    });

    it('at the instance', async function () {
      expect(await this.instance.connect(this.accounts.user1).transferOwnership(this.accounts.user2.address))
      .to.emit(this.vestingFactory, 'Transfer').withArgs(this.accounts.user1.address, this.accounts.user2.address, this.instance.address);
    });

    afterEach(async function () {
      expect(await this.instance.owner()).to.be.equal(this.accounts.user2.address);
      expect(await this.instance.beneficiary()).to.be.equal(this.accounts.user2.address);
      expect(await this.instance.start()).to.be.equal(this.now);
      expect(await this.instance.cliff()).to.be.equal(this.now + cliffDuration);
      expect(await this.instance.duration()).to.be.equal(vestingDuration);
    });
  });

  describe('with tokens', function () {
    beforeEach(async function () {
      await this.token.transfer(this.instance.address, value.mul(24));
    });

    it('release to various owners', async function () {
      await network.provider.send('evm_setNextBlockTimestamp', [ this.now ]);

      // not early release
      expect(await this.instance['release(address)'](this.token.address))
      .to.emit(this.token, 'Transfer').withArgs(this.instance.address, this.accounts.user1.address, '0');

      await network.provider.send('evm_increaseTime', [ 3600 ]);

      // release before cliff (1h)
      expect(await this.instance['release(address)'](this.token.address))
      .to.emit(this.token, 'Transfer').withArgs(this.instance.address, this.accounts.user1.address, '0');

      await network.provider.send('evm_increaseTime', [ 3600 ]);

      // release after cliff (2h)
      expect(await this.instance['release(address)'](this.token.address))
      .to.emit(this.token, 'Transfer').withArgs(this.instance.address, this.accounts.user1.address, value.mul(2));

      await network.provider.send('evm_increaseTime', [ 3600 ]);
      await this.vestingFactory.connect(this.accounts.user1).transferFrom(this.accounts.user1.address, this.accounts.user2.address, this.instance.address);

      // release after owner change
      expect(await this.instance['release(address)'](this.token.address))
      .to.emit(this.token, 'Transfer').withArgs(this.instance.address, this.accounts.user2.address, value.mul(1));

      await network.provider.send('evm_increaseTime', [ 3600 ]);
      await this.instance.connect(this.accounts.user2).transferOwnership(this.accounts.user3.address);

      // release after owner change
      expect(await this.instance['release(address)'](this.token.address))
      .to.emit(this.token, 'Transfer').withArgs(this.instance.address, this.accounts.user3.address, value.mul(1));
    });
  });
});