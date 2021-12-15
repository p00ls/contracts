const { ethers } = require('hardhat');
const { expect } = require('chai');

const { prepare, attach, utils } = require('../fixture.js');

describe('AMM', function () {
  prepare();

  before(async function () {
    this.accounts.artist = this.accounts.shift();
    this.accounts.user   = this.accounts.shift();
  });

  describe('with social token', function () {
    beforeEach(async function () {
      this.allocation = { index: 0, account: this.amm.auction.address, amount: ethers.utils.parseEther('100') };
      this.merkletree = utils.merkle.createMerkleTree([ utils.merkle.hashAllocation(this.allocation) ]);
      this.creatorToken  = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', '$Amxx', 'X Hadrien Croubois', 'x$Amxx', this.merkletree.getRoot());
      this.xCreatorToken = await this.workflows.getXCreatorToken(this.creatorToken);
      await this.creatorToken.claim(this.allocation.index, this.allocation.account, this.allocation.amount, this.merkletree.getHexProof(utils.merkle.hashAllocation(this.allocation)))

      expect(await this.creatorToken.balanceOf(this.amm.auction.address)).to.be.equal(this.allocation.amount);
    });

    describe('with dutch auction', function () {
      beforeEach(async function () {
        this.auction = await this.amm.auction.start(this.creatorToken.address, 14 * 86400)
        .then(tx => tx.wait())
        .then(receipt => receipt.events.find(({ event }) => event === 'AuctionCreated'))
        .then(event => event.args.auction)
        .then(address => attach('Auction', address));

        expect(await this.amm.auction.getAuctionInstance(this.creatorToken.address)).to.be.equal(this.auction.address);
        expect(await this.creatorToken.balanceOf(this.amm.auction.address)).to.be.equal(this.allocation.amount.div(2));
        expect(await this.creatorToken.balanceOf(this.auction.address)).to.be.equal(this.allocation.amount.div(2));
      });

      it('finalize too early', async function () {
        await expect(this.amm.auction.finalize(this.creatorToken.address))
        .to.be.revertedWith('Auction: auction not finished');
      });

      it('finalize with funds', async function () {
        const value = ethers.utils.parseEther('1');

        await this.accounts.user.sendTransaction({ to: this.auction.address, value });
        await network.provider.send('evm_increaseTime', [ 14 * 86400 ]);

        const tx                = await this.amm.auction.finalize(this.creatorToken.address);
        const unipair           = await this.amm.factory.getPair(this.weth.address, this.creatorToken.address).then(address => attach('UniswapV2Pair', address));
        const MINIMUM_LIQUIDITY = await unipair.MINIMUM_LIQUIDITY();

        await expect(tx)
        .to.emit(this.weth, 'Transfer').withArgs(ethers.constants.AddressZero, this.amm.router.address, value)
        .to.emit(this.weth, 'Transfer').withArgs(this.amm.router.address, unipair.address, value)
        .to.emit(this.creatorToken, 'Transfer').withArgs(this.amm.auction.address, unipair.address, this.allocation.amount.div(2))
        .to.emit(unipair, 'Transfer')//.withArgs(ethers.constants.AddressZero, '0xdead', MINIMUM_LIQUIDITY)
        .to.emit(unipair, 'Transfer')//.withArgs(ethers.constants.AddressZero, this.governance.timelock.address, null);

        expect(await this.creatorToken.balanceOf(this.amm.auction.address)).to.be.equal('0');
        expect(await this.creatorToken.balanceOf(this.auction.address)).to.be.equal(this.allocation.amount.div(2));
        expect(await this.creatorToken.balanceOf(unipair.address)).to.be.equal(this.allocation.amount.div(2));
        expect(await this.weth.balanceOf(unipair.address)).to.be.equal(value);

        expect(await unipair.balanceOf("0x000000000000000000000000000000000000dEaD")).to.be.gt(0);
        expect(await unipair.balanceOf(this.governance.timelock.address)).to.be.gt(0);
        expect(await unipair.balanceOf(this.accounts.user.address)).to.be.equal(0);
      });
    });
  });
});
