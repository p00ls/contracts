const { ethers } = require('hardhat');
const { expect } = require('chai');

const { migrate, CONFIG, attach, utils } = require('../scripts/migrate.js');

describe('$Crea Token', function () {
  before(async function () {
    await migrate().then(env => Object.assign(this, env));
    this.accounts.reserve = this.accounts.shift();
    this.accounts.artist  = this.accounts.shift();
    this.accounts.other   = this.accounts.shift();
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
      this.merkletree    = utils.merkle.createMerkleTree(this.allocations.map(utils.merkle.hashAllocation));
      this.creatortoken  = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', '$Amxx', this.merkletree.getRoot());
      this.creatorxtoken = await this.workflows.getXCreatorToken(this.creatortoken);
    });

    describe('Check state', function () {
      it('Creator registry', async function () {
        expect(await this.registry.name())
          .to.be.equal('P00ls Creator Token Registry');
        expect(await this.registry.symbol())
          .to.be.equal('P00ls');
        expect(await this.registry.owner())
          .to.be.equal(this.accounts.admin.address);
        expect(await this.registry.ownerOf(this.registry.address))
          .to.be.equal(this.accounts.admin.address);
        expect(await this.registry.tokenURI(this.registry.address))
          .to.be.equal(`${CONFIG.registry.baseuri}${ethers.BigNumber.from(this.registry.address).toString()}`);
        expect(await this.registry.admin())
          .to.be.equal(this.accounts.admin.address);
      });

      it('Creator token', async function () {
        expect(await this.creatortoken.name())
          .to.be.equal('Hadrien Croubois');
        expect(await this.creatortoken.symbol())
          .to.be.equal('$Amxx');
        expect(await this.creatortoken.owner())
          .to.be.equal(this.accounts.artist.address);
        expect(await this.registry.ownerOf(this.creatortoken.address))
          .to.be.equal(this.accounts.artist.address);
        expect(await this.registry.tokenURI(this.creatortoken.address))
          .to.be.equal(`${CONFIG.registry.baseuri}${ethers.BigNumber.from(this.creatortoken.address).toString()}`);
        expect(await this.creatortoken.admin())
          .to.be.equal(this.accounts.admin.address);
      });

      it('Creator xToken', async function () {
        expect(await this.creatorxtoken.name())
          .to.be.equal('xHadrien Croubois');
        expect(await this.creatorxtoken.symbol())
          .to.be.equal('x$Amxx');
        expect(await this.creatorxtoken.owner())
          .to.be.equal(this.accounts.artist.address);
      });
    });

    describe('Transfer ownership', function () {
      describe('Creator registry', function () {
        it('Protected', async function () {
          await expect(this.registry.connect(this.accounts.other).transferOwnership(this.accounts.other.address))
          .to.be.revertedWith('RegistryOwnable: caller is not the owner');
        });

        it('Authorized', async function () {
          await expect(this.registry.connect(this.accounts.admin).transferOwnership(this.accounts.other.address))
          .to.emit(this.registry, 'Transfer').withArgs(this.accounts.admin.address, this.accounts.other.address, this.registry.address);
        });
      });

      describe('Creator token', function () {
        it('Protected', async function () {
          await expect(this.creatortoken.connect(this.accounts.other).transferOwnership(this.accounts.other.address))
          .to.be.revertedWith('RegistryOwnable: caller is not the owner');
        });

        it('Authorized', async function () {
          await expect(this.creatortoken.connect(this.accounts.artist).transferOwnership(this.accounts.other.address))
          .to.emit(this.registry, 'Transfer').withArgs(this.accounts.artist.address, this.accounts.other.address, this.creatortoken.address);
        });
      });
    });

    it('Claim social token', async function () {
      for (const allocation of this.allocations) {
        const proof = this.merkletree.getHexProof(utils.merkle.hashAllocation(allocation));
        await expect(this.creatortoken.claim(allocation.index, allocation.account, allocation.amount, proof))
          .to.emit(this.creatortoken, 'Transfer')
          .withArgs(ethers.constants.AddressZero, allocation.account, allocation.amount);
      }
    });

    it.skip('Delegation', async function () {
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
