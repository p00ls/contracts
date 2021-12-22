const { ethers } = require('hardhat');
const { expect } = require('chai');

const { prepare, utils } = require('../fixture.js');

const VALUE = ethers.utils.parseEther('100');
const value = ethers.utils.parseEther('1');

describe('Auction', function () {
  prepare();

  before(async function () {
    this.accounts.artist = this.accounts.shift();
    this.accounts.user   = this.accounts.shift();
    this.accounts.other  = this.accounts.shift();
  });

  beforeEach(async function () {
    // create creator token with allocation to the auction manager
    this.allocations = [
      { index: 0, account: this.auction.address, amount: VALUE },
    ],
    this.merkletree    = utils.merkle.createMerkleTree(this.allocations.map(utils.merkle.hashAllocation));
    this.creatorToken  = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', '$Amxx', 'X Hadrien Croubois', 'x$Amxx', this.merkletree.getRoot());
    this.xCreatorToken = await this.workflows.getXCreatorToken(this.creatorToken);
    await Promise.all(this.allocations.map(allocation => this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, this.merkletree.getHexProof(utils.merkle.hashAllocation(allocation)))));
  });

  describe('before auction', function () {
    it('check balances', async function () {
      expect(await this.creatorToken.balanceOf(this.auction.address)).to.be.equal(VALUE);
      expect(await this.creatorToken.balanceOf(this.accounts.user.address)).to.be.equal(0);
    });
  });

  it('get instance', async function () {
    await expect(this.auction.getAuctionInstance(this.creatorToken.address))
    .to.be.revertedWith('No auction for this token');
  });

  it('cannot star instance without a balance', async function () {
    const { timestamp: now } = await ethers.provider.getBlock('latest');
    await expect(this.auction.start(this.xCreatorToken.address, now, 14 * 86400))
    .to.be.reverted;
  });

  it('eth payments are locked', async function () {
    await expect(this.accounts.user.sendTransaction({ to: this.auction.address, value }))
    .to.be.reverted;
  });

  describe('with auction', function () {
    beforeEach(async function () {
      const { timestamp: now } = await ethers.provider.getBlock('latest');
      const txPromise = this.auction.start(this.creatorToken.address, now, 14 * 86400);

      this.auction_instance = await this.auction.getAuctionInstance(this.creatorToken.address).then(address => utils.attach('Auction', address));

      await expect(txPromise)
      .to.emit(this.auction, 'AuctionCreated').withArgs(this.creatorToken.address, this.auction_instance.address)
      .to.emit(this.creatorToken, 'Transfer').withArgs(this.auction.address, this.auction_instance.address, VALUE.div(2));
    });

    it('check balances', async function () {
      expect(await this.creatorToken.balanceOf(this.auction.address)).to.be.equal(VALUE.div(2));
      expect(await this.creatorToken.balanceOf(this.auction_instance.address)).to.be.equal(VALUE.div(2));
      expect(await this.creatorToken.balanceOf(this.accounts.user.address)).to.be.equal(0);
    });

    describe('before auction ends', function () {
      it('can commit by sending eth directly', async function () {
        await expect(await this.accounts.user.sendTransaction({ to: this.auction_instance.address, value }))
        .to.emit(this.auction_instance, 'Transfer').withArgs(ethers.constants.AddressZero, this.accounts.user.address, value)
        .to.changeEtherBalances([ this.accounts.user, this.auction_instance ], [ value.mul(-1), value ]);
      });

      it('can commit', async function () {
        await expect(await this.auction_instance.connect(this.accounts.user).commit(this.accounts.other.address, { value }))
        .to.emit(this.auction_instance, 'Transfer').withArgs(ethers.constants.AddressZero, this.accounts.other.address, value)
        .to.changeEtherBalances([ this.accounts.user, this.auction_instance ], [ value.mul(-1), value ]);

      });

      it('can leave', async function () {
        await this.accounts.user.sendTransaction({ to: this.auction_instance.address, value });

        await expect(await this.auction_instance.connect(this.accounts.user).leave(this.accounts.other.address))
        .to.emit(this.auction_instance, 'Transfer').withArgs(this.accounts.user.address, ethers.constants.AddressZero, value)
        .to.changeEtherBalances([ this.auction_instance, this.accounts.other ], [ value.mul(80).div(100).mul(-1), value.mul(80).div(100) ]);
      });

      it('cannot withdraw', async function () {
        await this.accounts.user.sendTransaction({ to: this.auction_instance.address, value });

        await expect(this.auction_instance.connect(this.accounts.user).withdraw(this.accounts.other.address))
        .to.be.revertedWith('Auction: auction not finished');
      });

      it('cannot finalize', async function () {
        await expect(this.auction.finalize(this.creatorToken.address))
        .to.be.revertedWith('Auction: auction not finished');
      });
    });

    describe('after auction end', function () {
      beforeEach(async function () {
        await this.accounts.user.sendTransaction({ to: this.auction_instance.address, value });
        await network.provider.send('evm_increaseTime', [ 24 * 86400 ]);
      });

      it('cannot commit by sending eth directly', async function () {
        await expect(this.accounts.user.sendTransaction({ to: this.auction_instance.address, value }))
        .to.be.revertedWith('Auction: auction not active');
      });

      it('cannot commit', async function () {
        await expect(this.auction_instance.connect(this.accounts.user).commit(this.accounts.other.address, { value }))
        .to.be.revertedWith('Auction: auction not active');
      });

      it('cannot leave', async function () {
        await expect(this.auction_instance.connect(this.accounts.user).leave(this.accounts.other.address))
        .to.be.revertedWith('Auction: auction not active');
      });

      it('can withdraw', async function () {
        expect(await this.auction_instance.ethToAuctionned(value)).to.be.equal(VALUE.div(2));

        await expect(this.auction_instance.connect(this.accounts.user).withdraw(this.accounts.other.address))
        .to.emit(this.auction_instance, 'Transfer').withArgs(this.accounts.user.address, ethers.constants.AddressZero, value)
        .to.emit(this.creatorToken, 'Transfer').withArgs(this.auction_instance.address, this.accounts.other.address, VALUE.div(2));
      });

      it('can finalize', async function () {
        const tx = await this.auction.finalize(this.creatorToken.address);

        const pair = await this.factory.getPair(
          this.creatorToken.address,
          this.weth.address
        ).then(address => utils.attach('UniswapV2Pair', address));

        await expect(tx)
        .to.emit(this.creatorToken, 'Approval').withArgs(this.auction.address, this.router.address, VALUE.div(2))
        .to.emit(this.creatorToken, 'Approval').withArgs(this.auction.address, this.router.address, 0)
        .to.emit(this.creatorToken, 'Transfer').withArgs(this.auction.address, pair.address, VALUE.div(2))
        .to.emit(this.weth, 'Transfer').withArgs(ethers.constants.AddressZero, this.router.address, value)
        .to.emit(this.weth, 'Transfer').withArgs(this.router.address, pair.address, value)
        .to.emit(pair, 'Transfer')
        .to.changeEtherBalances([ this.auction_instance, this.weth ], [ value.mul(-1), value ])
      });
    });
  });
});
