const { ethers } = require('hardhat');
const { expect } = require('chai');

const migrate = require('./utils/migrate.js')
const merkle  = require('./utils/merkle.js')

const TARGETSUPPLY = ethers.utils.parseEther('1000000000'); // 1 billion tokens

describe('Main', function () {
  migrate();

  before(async function () {
    this.accounts.artist = this.accounts.shift();
  });

  it('check', async function () {
    expect(await this.registry.owner()).to.be.equal(this.accounts.admin.address);
    expect(await this.registry.ownerOf(this.registry.address)).to.be.equal(this.accounts.admin.address);
  });

  describe('with collection', function () {
    beforeEach(async function () {
      // Random weight to initial fans
      const weights = Array(32).fill().map(() => ({
        account: ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.randomBytes(20))),
        weight:  ethers.utils.randomBytes(1)[0],
      }));
      weights.sum = weights.map(({ weight }) => weight).reduce((a, b) => a + b, 0);

      // Precompute allocations
      this.allocations = [
        // 30% divided among initial followers
        ...weights.map(({ account, weight }) => ({
          account,
          amount: TARGETSUPPLY.mul(30).div(100).mul(weight).div(weights.sum),
        })),
        // 10% for the artist
        {
          account: this.accounts.artist.address,
          amount: TARGETSUPPLY.mul(10).div(100),
        },
        // TODO: 10% for liquidity
        // {
        //   account: this.accounts.admin.address,
        //   amount: TARGETSUPPLY.mul(10).div(100),
        // },
        // TOTO: 50% as a reserve
        // {
        //   account: ,
        //   amount: TARGETSUPPLY.mul(50).div(100),
        // },
      ].map((obj, index) => Object.assign(obj, { index }));

      // Construct merkletree
      this.merkletree = merkle.createMerkleTree(this.allocations.map(merkle.hashAllocation));

      // Mint social token
      const { wait    } = await this.registry.createToken(this.accounts.artist.address, 'Hadrien Croubois', 'Amxx', this.merkletree.getHexRoot());
      const { events  } = await wait();
      const { tokenId } = events.find(({ event }) => event === 'Transfer').args;
      this.token = await migrate.attach('P00lsCreatorToken', ethers.utils.hexlify(tokenId));
    });

    it('Check social token', async function () {
      expect(await this.token.name())
        .to.be.equal('Hadrien Croubois');
      expect(await this.token.symbol())
        .to.be.equal('Amxx');
      expect(await this.token.owner())
        .to.be.equal(this.accounts.artist.address);
      expect(await this.registry.ownerOf(this.token.address))
        .to.be.equal(this.accounts.artist.address);
      expect(await this.registry.tokenURI(this.token.address))
        .to.be.equal(`${migrate.CONFIG.registry.baseuri}${ethers.BigNumber.from(this.token.address).toString()}`);
    });

    it('Claim social token', async function () {
      for (const allocation of this.allocations) {
        const proof = this.merkletree.getHexProof(merkle.hashAllocation(allocation));
        await expect(this.token.claim(allocation.index, allocation.account, allocation.amount, proof))
          .to.emit(this.token, 'Transfer')
          .withArgs(ethers.constants.AddressZero, allocation.account, allocation.amount);
      }
    });
  });
});
