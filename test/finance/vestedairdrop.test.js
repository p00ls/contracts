const { ethers } = require('hardhat');
const { expect } = require('chai');

const { prepare, utils } = require('../fixture.js');

const VALUE = ethers.utils.parseEther('100');

function vestedAmount({ start, cliff, duration, amount }, timestamp) {
  return timestamp < start + cliff
    ? ethers.constants.Zero
    : duration == 0
    ? amount
    : amount.mul(Math.min(timestamp - start, duration)).div(duration);
}

describe('Vested airdrop', function () {
  prepare();

  before(async function () {
    this.accounts.artist = this.accounts.shift();
    this.accounts.user   = this.accounts.shift();
    this.accounts.other  = this.accounts.shift();
  });

  beforeEach(async function () {
    this.now = await ethers.provider.getBlock().then(({ timestamp }) => timestamp + 10); // leave some gap

    // create creator token with allocation to the auction manager
    this.allocations = [
      { index: 0, account: this.vestedAirdrop.address, amount: VALUE },
    ],
    this.merkletree    = utils.merkle.createMerkleTree(this.allocations.map(utils.merkle.hashAllocation));
    this.creatorToken  = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', '$Amxx', 'X Hadrien Croubois', 'x$Amxx', this.merkletree.getRoot());
    this.xCreatorToken = await this.workflows.getXCreatorToken(this.creatorToken);
    await Promise.all(this.allocations.map(allocation => this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, this.merkletree.getHexProof(utils.merkle.hashAllocation(allocation)))));

    this.vestings = [
      { index: 0, start: 0,        cliff:   0, duration:   0, token: this.creatorToken.address, recipient: this.accounts.user.address, amount: ethers.utils.parseEther('1') },
      { index: 1, start: this.now, cliff: 100, duration: 300, token: this.creatorToken.address, recipient: this.accounts.user.address, amount: ethers.utils.parseEther('1') },
    ];
    this.merkletree = utils.merkle.createMerkleTree(this.vestings.map(utils.merkle.hashVesting));
    this.hexroot    = ethers.utils.hexlify(this.merkletree.getRoot());
  });

  it('restricted access to admin function', async function () {
    expect(await this.vestedAirdrop.enabled(this.hexroot)).to.be.false;

    await expect(this.vestedAirdrop.connect(this.accounts.other).enableAirdrop(this.hexroot, true))
    .to.be.revertedWith(`AccessControl: account ${this.accounts.other.address.toLowerCase()} is missing role ${this.roles.VESTING_MANAGER}`);

    expect(await this.vestedAirdrop.enabled(this.hexroot)).to.be.false;
  });

  it('can enable & disable airdrop', async function () {
    expect(await this.vestedAirdrop.enabled(this.hexroot)).to.be.false;

    await expect(this.vestedAirdrop.enableAirdrop(this.hexroot, true))
    .to.emit(this.vestedAirdrop, 'Airdrop').withArgs(this.hexroot, true);

    expect(await this.vestedAirdrop.enabled(this.hexroot)).to.be.true;

    await expect(this.vestedAirdrop.enableAirdrop(this.hexroot, false))
    .to.emit(this.vestedAirdrop, 'Airdrop').withArgs(this.hexroot, false);

    expect(await this.vestedAirdrop.enabled(this.hexroot)).to.be.false;
  });

  it('cannot unlock for disabled airdrop', async function () {
    const vesting     = this.vestings[0];
    const vestingHash = utils.merkle.hashVesting(vesting)
    const proof       = this.merkletree.getHexProof(vestingHash);

    await expect(this.vestedAirdrop.release(vesting, proof))
    .to.be.revertedWith('VestedAirdrops: unknown airdrop');
  });

  describe('with airdrop enabled', function () {
    beforeEach(async function () {
      await this.vestedAirdrop.enableAirdrop(this.hexroot, true);
    });

    it('unlock all at once', async function () {
      const vesting     = this.vestings[0];
      const vestingHash = utils.merkle.hashVesting(vesting)
      const proof       = this.merkletree.getHexProof(vestingHash);

      await expect(this.vestedAirdrop.release(vesting, proof))
      .to.emit(this.vestedAirdrop, 'TokensReleased').withArgs(this.hexroot, ethers.utils.hexlify(vestingHash), vesting.token, vesting.recipient, vesting.amount, vesting.amount)
      .to.emit(this.creatorToken, 'Transfer').withArgs(this.vestedAirdrop.address, vesting.recipient, vesting.amount);
    });

    it('apply schedule', async function () {
      const vesting     = this.vestings[1];
      const vestingHash = utils.merkle.hashVesting(vesting)
      const proof       = this.merkletree.getHexProof(vestingHash);

      for (const timestamp of Array(16).fill().map((_, i) => this.now + 30 * i)) {
        await network.provider.send('evm_setNextBlockTimestamp', [ timestamp ]);

        const vested      = vestedAmount(vesting, timestamp);
        const released    = await this.vestedAirdrop.released(vestingHash);
        const releasable  = vested.sub(released);

        expect(await this.vestedAirdrop.vestedAmount(vesting, timestamp)).to.be.equal(vested);

        const tx = await this.vestedAirdrop.release(vesting, proof);
        if (releasable.isZero()) {
          await expect(tx)
          .to.not.emit(this.vestedAirdrop, 'TokensReleased')
          .to.not.emit(this.creatorToken, 'Transfer');
        } else {
          await expect(tx)
          .to.emit(this.vestedAirdrop, 'TokensReleased').withArgs(this.hexroot, ethers.utils.hexlify(vestingHash), vesting.token, vesting.recipient, releasable, vesting.amount)
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.vestedAirdrop.address, vesting.recipient, releasable);
        }

        expect(await this.vestedAirdrop.released(vestingHash)).to.be.equal(vested)
      }
    });
  });
});