const { ethers } = require('hardhat');
const { expect } = require('chai');

const { prepare } = require('../fixture.js');
const { getDomain, Distribution, Allocation } = require('../helpers/eip712.js');

const VALUE = ethers.utils.parseEther('100');

describe('Distribution Protocol', function () {
  prepare();

  before(async function () {
    this.accounts.artist = this.accounts.shift();
    this.accounts.oracle = this.accounts.shift();
    this.accounts.user1  = this.accounts.shift();
    this.accounts.user2  = this.accounts.shift();
    this.accounts.user3  = this.accounts.shift();
    this.accounts.other  = this.accounts.shift();
  });

  beforeEach(async function () {
    this.distribution = await ethers.deployContract('DistributionProtocol');
    this.domain = await getDomain(this.distribution);

    await this.token.connect(this.accounts.admin).transfer(this.accounts.artist.address, VALUE);
    await this.token.connect(this.accounts.artist).approve(this.distribution.address, ethers.constants.MaxUint256);
  });


  describe('process', async function () {
    beforeEach(async function () {
      await this.distribution.deposit(this.accounts.artist.address, { value: ethers.utils.parseEther('1') });
      await this.distribution.connect(this.accounts.artist).setOracle(this.accounts.oracle.address, this.token.address, true);
    });

    it('nominal', async function () {
      const owner = this.accounts.artist.address;
      const allocations = [
        { token: this.token.address, recipient: this.accounts.user1.address, amount: ethers.utils.parseEther('1') },
        { token: this.token.address, recipient: this.accounts.user2.address, amount: ethers.utils.parseEther('2') },
        { token: this.token.address, recipient: this.accounts.user3.address, amount: ethers.utils.parseEther('3') },
      ];
      const nonce = 0;
      const signature = await this.accounts.oracle._signTypedData(
        this.domain,
        { Distribution, Allocation },
        { owner, allocations, nonce },
      );

      const balanceBefore = await ethers.provider.getBalance(this.accounts.other.address);

      const tx = await this.distribution.connect(this.accounts.other).process(owner, allocations, nonce, signature);
      await expect(tx)
        .to.emit(this.token, 'Transfer').withArgs(owner, allocations[0].recipient, allocations[0].amount)
        .to.emit(this.token, 'Transfer').withArgs(owner, allocations[1].recipient, allocations[1].amount)
        .to.emit(this.token, 'Transfer').withArgs(owner, allocations[2].recipient, allocations[2].amount);

      const balanceAfter = await ethers.provider.getBalance(this.accounts.other.address);
      console.log(`tx.origin balance change (in unit of gas): ${(balanceAfter - balanceBefore) / tx.gasPrice}`);
    });

    it('invalid oracle', async function () {
      const owner = this.accounts.artist.address;
      const allocations = [
        { token: this.token.address, recipient: this.accounts.user1.address, amount: ethers.utils.parseEther('1') },
        { token: this.token.address, recipient: this.accounts.user2.address, amount: ethers.utils.parseEther('2') },
        { token: this.token.address, recipient: this.accounts.user3.address, amount: ethers.utils.parseEther('3') },
      ];
      const nonce = 0;
      const signature = await this.accounts.other._signTypedData(
        this.domain,
        { Distribution, Allocation },
        { owner, allocations, nonce },
      );

      await expect(this.distribution.connect(this.accounts.other).process(owner, allocations, nonce, signature))
        .to.be.revertedWith(`Unauthorized("${owner}", "${this.accounts.other.address}", "${this.token.address}")`);
    });

    it('without owner approval', async function () {
      const owner = this.accounts.other.address;
      const allocations = [
        { token: this.token.address, recipient: this.accounts.user1.address, amount: ethers.utils.parseEther('1') },
        { token: this.token.address, recipient: this.accounts.user2.address, amount: ethers.utils.parseEther('2') },
        { token: this.token.address, recipient: this.accounts.user3.address, amount: ethers.utils.parseEther('3') },
      ];
      const nonce = 0;
      const signature = await this.accounts.oracle._signTypedData(
        this.domain,
        { Distribution, Allocation },
        { owner, allocations, nonce },
      );

      await expect(this.distribution.connect(this.accounts.other).process(owner, allocations, nonce, signature))
        .to.be.revertedWith(`Unauthorized("${this.accounts.other.address}", "${this.accounts.oracle.address}", "${this.token.address}")`);
    });
  });
});
