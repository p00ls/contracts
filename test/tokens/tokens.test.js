const { ethers } = require('hardhat');
const { expect } = require('chai');

const { CONFIG, prepare, utils } = require('../fixture.js');

describe('$Crea Token', function () {
  prepare();

  before(async function () {
    this.accounts.reserve = this.accounts.shift();
    this.accounts.artist  = this.accounts.shift();
    this.accounts.user    = this.accounts.shift();
    this.accounts.other   = this.accounts.shift();
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
      this.creatorToken  = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', '$Amxx', this.merkletree.getRoot());
      this.xCreatorToken = await this.workflows.getXCreatorToken(this.creatorToken);
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

        expect(await this.registry.ownerOf(this.creatorToken.address))
          .to.be.equal(this.accounts.artist.address);
        expect(await this.registry.tokenURI(this.creatorToken.address))
          .to.be.equal(`${CONFIG.registry.baseuri}${ethers.BigNumber.from(this.creatorToken.address).toString()}`);
        expect(await this.creatorToken.admin())
          .to.be.equal(this.accounts.admin.address);
      });

      it('Creator token', async function () {
        expect(await this.creatorToken.name())
          .to.be.equal('Hadrien Croubois');
        expect(await this.creatorToken.symbol())
          .to.be.equal('$Amxx');
        expect(await this.creatorToken.owner())
          .to.be.equal(this.accounts.artist.address);
      });

      it('Creator xToken', async function () {
        expect(await this.xCreatorToken.name())
          .to.be.equal('xHadrien Croubois');
        expect(await this.xCreatorToken.symbol())
          .to.be.equal('x$Amxx');
        expect(await this.xCreatorToken.owner())
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
          await expect(this.creatorToken.connect(this.accounts.other).transferOwnership(this.accounts.other.address))
          .to.be.revertedWith('RegistryOwnable: caller is not the owner');
        });

        it('Authorized', async function () {
          await expect(this.creatorToken.connect(this.accounts.artist).transferOwnership(this.accounts.other.address))
          .to.emit(this.registry, 'Transfer').withArgs(this.accounts.artist.address, this.accounts.other.address, this.creatorToken.address);
        });
      });
    });

    describe('Claiming', function () {
      it('protected against invalid proof and replay', async function () {
        for (const allocation of this.allocations) {
          const proof = this.merkletree.getHexProof(utils.merkle.hashAllocation(allocation));

          expect(await this.creatorToken.isClaimed(allocation.index)).to.be.false;

          await expect(this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, []))
          .to.be.revertedWith('P00lsTokenCreator::claim: invalid merkle proof');

          await expect(this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, proof))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(ethers.constants.AddressZero, allocation.account, allocation.amount);

          await expect(this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, proof))
          .to.be.revertedWith('P00lsTokenCreator::claim: drop already claimed');

          expect(await this.creatorToken.isClaimed(allocation.index)).to.be.true;
        }
      });
    });

    describe('Delegation', function () {
      it('delegate on creator affect xcreator', async function () {
        await expect(this.creatorToken.connect(this.accounts.user).delegate(this.accounts.other.address))
        .to.emit(this.creatorToken,  'DelegateChanged').withArgs(this.accounts.user.address, ethers.constants.AddressZero, this.accounts.other.address)
        .to.emit(this.xCreatorToken, 'DelegateChanged').withArgs(this.accounts.user.address, ethers.constants.AddressZero, this.accounts.other.address);
      });

      it('delegation hook is protected', async function () {
        await expect(this.xCreatorToken.connect(this.accounts.user).__delegate(this.accounts.user.address, this.accounts.other.address))
        .to.be.revertedWith('P00lsTokenXCreator: creator token restricted');
      });

      it('delegation on xcreator is disabled', async function () {
        await expect(this.xCreatorToken.connect(this.accounts.user).delegate(this.accounts.other.address))
        .to.be.revertedWith('P00lsTokenXCreator: delegation is registered on the creatorToken')

        await expect(this.xCreatorToken.connect(this.accounts.user).delegateBySig(this.accounts.other.address, 0, 0, 0, ethers.constants.HashZero, ethers.constants.HashZero))
        .to.be.revertedWith('P00lsTokenXCreator: delegation is registered on the creatorToken')
      });
    });
  });
});
