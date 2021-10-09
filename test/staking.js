const { ethers } = require('hardhat');
const { expect } = require('chai');

const { migrate, attach, utils } = require('../scripts/migrate.js');


const VALUE = ethers.utils.parseEther('100');

describe('Staking', function () {
  before(async function () {
    await migrate().then(env => Object.assign(this, env));
    this.accounts.artist = this.accounts.shift();
    this.accounts.user   = this.accounts.shift();
    __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
  });

  beforeEach(async function() {
    await ethers.provider.send('evm_revert', [ __SNAPSHOT_ID__ ])
    __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
  });

  describe('with social token', function () {
    beforeEach(async function () {

      // create creator token with allocation to the auction manager
      this.allocations = [
        { index: 0, account: this.amm.auction.address, amount: VALUE },
        { index: 1, account: this.staking.address,     amount: VALUE },
      ],
      this.merkletree   = utils.merkle.createMerkleTree(this.allocations.map(utils.merkle.hashAllocation));
      this.creatorToken = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', 'Amxx', this.merkletree.getRoot());
      await Promise.all(this.allocations.map(allocation => this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, this.merkletree.getHexProof(utils.merkle.hashAllocation(allocation)))));

      // allocate pool to the auction manager
      this.token.transfer(this.amm.auction.address, VALUE);

      // check balances
      expect(await this.token.balanceOf(this.amm.auction.address)).to.be.equal(VALUE);
      expect(await this.creatorToken.balanceOf(this.amm.auction.address)).to.be.equal(VALUE);

      // initiate auction
      this.auctions = await Promise.all([ this.token, this.creatorToken ].map(token =>
        this.amm.auction.start(token.address)
        .then(tx => tx.wait())
        .then(receipt => receipt.events.find(({ event }) => event === 'AuctionCreated'))
        .then(event => event.args.auction)
        .then(address => attach('Auction', address))
      ));

      // run auctions
      await this.accounts.user.sendTransaction({ to: this.auctions[0].address, value: ethers.utils.parseEther('10') });
      await this.accounts.user.sendTransaction({ to: this.auctions[1].address, value: ethers.utils.parseEther('1')  });
      await network.provider.send('evm_increaseTime', [ 24 * 86400 ]);
      await this.amm.auction.finalize(this.token.address);
      await this.amm.auction.finalize(this.creatorToken.address);

      // withdraw funds
      await this.auctions[0].withdraw(this.accounts.user.address);
      await this.auctions[1].withdraw(this.accounts.user.address);

      // check balances
      expect(await this.token.balanceOf(this.amm.auction.address)).to.be.equal('0');
      expect(await this.token.balanceOf(this.accounts.user.address)).to.be.equal(VALUE.div(2));
      expect(await this.creatorToken.balanceOf(this.amm.auction.address)).to.be.equal('0');
      expect(await this.creatorToken.balanceOf(this.accounts.user.address)).to.be.equal(VALUE.div(2));
    });

    for (const months of new Array(12).fill().map((_, i) => (i + 1) * 3)) {
      it(`Duration ${months} months`, async function () {
        await expect(this.creatorToken.connect(this.accounts.user).approve(this.staking.address, ethers.constants.MaxUint256))
        .to.be.not.reverted;

        const tx1 = await this.staking.lockSetup(
          this.creatorToken.address,
        );

        const tx2 = await this.staking.connect(this.accounts.user).vaultSetup(
          this.creatorToken.address,
          months * 30 * 86400,
        );

        const tx3 = await this.staking.connect(this.accounts.user).deposit(
          this.creatorToken.address,
          VALUE.div(4), // value
          0, // no extra
          this.accounts.user.address
        );

        const lockDetails  = await this.staking.lockDetails(this.creatorToken.address);
        const vaultDetails = await this.staking.vaultDetails(this.creatorToken.address, this.accounts.user.address);

        const timestamp = await ethers.provider.getBlock(tx1.blockNumber).then(({ timestamp }) => timestamp);
        const start     = timestamp +          30 * 86400
        const maturity  = start     + months * 30 * 86400
        await expect(lockDetails.start).to.be.equal(start);
        await expect(lockDetails.reward).to.be.equal(VALUE);
        await expect(vaultDetails.maturity).to.be.equal(maturity);
        await expect(vaultDetails.value).to.be.equal(VALUE.div(4));
        await expect(vaultDetails.extra).to.be.equal(0);
        expect(lockDetails.totalWeight).to.be.equal(vaultDetails.weight);

        console.log(months, vaultDetails.weight.toString())

      });

    }
  });
});
