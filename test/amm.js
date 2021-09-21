const { ethers } = require('hardhat');
const { expect } = require('chai');

const { migrate, attach, utils } = require('../scripts/migrate.js');

describe('AMM', function () {
  before(async function () {
    await migrate().then(env => Object.assign(this, env));
    this.accounts.artist = this.accounts.shift();
    this.accounts.user   = this.accounts.shift();
  });

  describe('with social token', function () {
    beforeEach(async function () {
      this.allocation = { index: 0, account: this.amm.auction.address, amount: ethers.utils.parseEther('100') };
      this.merkletree = utils.merkle.createMerkleTree([ utils.merkle.hashAllocation(this.allocation) ]);
      this.token      = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', 'Amxx', this.merkletree.getRoot());
      await this.token.claim(this.allocation.index, this.allocation.account, this.allocation.amount, this.merkletree.getHexProof(utils.merkle.hashAllocation(this.allocation)))

      expect(await this.token.balanceOf(this.amm.auction.address)).to.be.equal(this.allocation.amount);
    });

    describe('with dutch auction', function () {
      beforeEach(async function () {
        this.auction = await this.amm.auction.start(this.token.address)
        .then(tx => tx.wait())
        .then(receipt => receipt.events.find(({ event }) => event === 'DutchAuctionCreated'))
        .then(event => event.args.auction)
        .then(address => attach('DutchAuction', address));

        expect(await this.amm.auction.getAuctionInstance(this.token.address)).to.be.equal(this.auction.address);
        expect(await this.token.balanceOf(this.amm.auction.address)).to.be.equal(this.allocation.amount.div(2));
        expect(await this.token.balanceOf(this.auction.address)).to.be.equal(this.allocation.amount.div(2));
      });

      it('finalize too early', async function () {
        await expect(this.amm.auction.finalize(this.token.address))
        .to.be.revertedWith('DutchAuction: auction has not finished yet');
      });

      it('finalize with funds', async function () {
        const value = ethers.utils.parseEther('1');

        await this.accounts.user.sendTransaction({ to: this.auction.address, value });
        await network.provider.send('evm_increaseTime', [ 24 * 86400 ]);

        const tx                = await this.amm.auction.finalize(this.token.address);
        const unipair           = await this.amm.factory.getPair(this.weth.address, this.token.address).then(address => attach('UniswapV2Pair', address));
        const MINIMUM_LIQUIDITY = await unipair.MINIMUM_LIQUIDITY();

        await expect(tx)
        .to.emit(this.weth, 'Transfer').withArgs(ethers.constants.AddressZero, this.amm.router.address, value)
        .to.emit(this.weth, 'Transfer').withArgs(this.amm.router.address, unipair.address, value)
        .to.emit(this.token, 'Transfer').withArgs(this.amm.auction.address, unipair.address, this.allocation.amount.div(2))
        .to.emit(unipair, 'Transfer')//.withArgs(ethers.constants.AddressZero, '0xdead', MINIMUM_LIQUIDITY)
        .to.emit(unipair, 'Transfer')//.withArgs(ethers.constants.AddressZero, this.accounts.user.address, null);

        expect(await this.token.balanceOf(this.amm.auction.address)).to.be.equal('0');
        expect(await this.token.balanceOf(this.auction.address)).to.be.equal(this.allocation.amount.div(2));
        expect(await this.token.balanceOf(unipair.address)).to.be.equal(this.allocation.amount.div(2));
        expect(await this.weth.balanceOf(unipair.address)).to.be.equal(value);
      });
    });
  });
});
