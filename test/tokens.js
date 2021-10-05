const { ethers } = require('hardhat');
const { expect } = require('chai');

const { migrate, CONFIG, attach, utils } = require('../scripts/migrate.js');

describe('$Crea Token', function () {
  before(async function () {
    await migrate().then(env => Object.assign(this, env));
    this.accounts.reserve = this.accounts.shift();
    this.accounts.artist  = this.accounts.shift();
    __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
  });

  beforeEach(async function() {
    await ethers.provider.send('evm_revert', [ __SNAPSHOT_ID__ ])
    __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
  });

  it('check', async function () {
    expect(await this.registry.owner()).to.be.equal(this.accounts.admin.address);
    expect(await this.registry.ownerOf(this.registry.address)).to.be.equal(this.accounts.admin.address);
  });

  describe('with collection', function () {
    beforeEach(async function () {
      // Precompute allocations
      this.allocations = [
        // 40% vesting (creator + user)
        {
          account: this.vesting.address,
          amount: CONFIG.TARGETSUPPLY.mul(40).div(100),
        },
        // 10% AMM (+ dutch auction)
        {
          account: this.amm.auction.address,
          amount: CONFIG.TARGETSUPPLY.mul(10).div(100),
        },
        // 50% staking & liquidity mining - TODO
        {
          account: this.accounts.reserve.address,
          amount: CONFIG.TARGETSUPPLY.mul(50).div(100),
        },
      ].map((obj, index) => Object.assign(obj, { index }));

      // Construct merkletree
      this.merkletree = utils.merkle.createMerkleTree(this.allocations.map(utils.merkle.hashAllocation));
      this.creatortoken = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', 'Amxx', this.merkletree.getRoot());
    });

    it('Check social token', async function () {
      expect(await this.creatortoken.name())
        .to.be.equal('Hadrien Croubois');
      expect(await this.creatortoken.symbol())
        .to.be.equal('Amxx');
      expect(await this.creatortoken.owner())
        .to.be.equal(this.accounts.artist.address);
      expect(await this.registry.ownerOf(this.creatortoken.address))
        .to.be.equal(this.accounts.artist.address);
      expect(await this.registry.tokenURI(this.creatortoken.address))
        .to.be.equal(`${CONFIG.registry.baseuri}${ethers.BigNumber.from(this.creatortoken.address).toString()}`);
    });

    it('Claim social token', async function () {
      for (const allocation of this.allocations) {
        const proof = this.merkletree.getHexProof(utils.merkle.hashAllocation(allocation));
        await expect(this.creatortoken.claim(allocation.index, allocation.account, allocation.amount, proof))
          .to.emit(this.creatortoken, 'Transfer')
          .withArgs(ethers.constants.AddressZero, allocation.account, allocation.amount);
      }
    });

    it.skip('User vesting', async function () {

      // Random weight to initial fans
      // const weights = Array(32).fill().map(() => ({
      //   account: ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.randomBytes(20))),
      //   weight:  ethers.utils.randomBytes(1)[0],
      // }));
      // weights.sum = weights.map(({ weight }) => weight).reduce((a, b) => a + b, 0);









    });


  });
});
