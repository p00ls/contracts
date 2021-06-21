const { ethers } = require('hardhat');
const { expect } = require('chai');

const migrate = require('./utils/migrate.js');
const merkle  = require('./utils/merkle.js');

describe('AMM', function () {
  migrate();

  before(async function () {
    this.accounts.artist = this.accounts.shift();
    this.accounts.user   = this.accounts.shift();
  });

  describe('with social token', function () {
    beforeEach(async function () {
      this.allocation = { index: 0, account: this.accounts.user.address, amount: ethers.utils.parseEther('100') };
      const merkletree = merkle.createMerkleTree([ merkle.hashAllocation(this.allocation) ]);
      const { wait    } = await this.registry.createToken(this.accounts.artist.address, 'Hadrien Croubois', 'Amxx', merkletree.getHexRoot());
      const { events  } = await wait();
      const { tokenId } = events.find(({ event }) => event === 'Transfer').args;
      this.token = await migrate.attach('P00lsCreatorToken', ethers.utils.hexlify(tokenId));
      await this.token.claim(this.allocation.index, this.allocation.account, this.allocation.amount, merkletree.getHexProof(merkle.hashAllocation(this.allocation)))
    });

    it('sanity check', async function () {
      expect(await this.token.balanceOf(this.accounts.user.address)).to.be.equal(this.allocation.amount);
    });

    it('add liquidity', async function () {
      await this.token.connect(this.accounts.user).approve(this.amm.router.address, ethers.utils.parseEther('1'));

      await expect(this.amm.factory.createPair(this.amm.weth.address, this.token.address))
        .to.emit(this.amm.factory, 'PairCreated');

      this.pair = await migrate.attach('P00lsAMMPair' , await this.amm.factory.getPair(this.amm.weth.address, this.token.address));

      await expect(this.amm.router.connect(this.accounts.user).addLiquidityETH(
        this.token.address,
        ethers.utils.parseEther('1'),
        0,
        0,
        this.accounts.user.address,
        ethers.constants.MaxUint256,
        { value: ethers.utils.parseEther('1') },
      ))
      .to.not.be.reverted
      // .to.emit(this.weth, 'Transfer').withArgs(ethers.constants.AddressZero, this.pair.address, ethers.utils.parseEther('1'))
      // .to.emit(this.token, 'Transfer').withArgs(this.accounts.user.address, this.pair.address, ethers.utils.parseEther('1'))
      // .to.emit(this.pair, 'Transfer').withArgs(ethers.constants.AddressZero, "0xdead", null)
      // .to.emit(this.pair, 'Transfer').withArgs(ethers.constants.AddressZero, this.accounts.user.address, null)

      const MINIMUM_LIQUIDITY = await this.pair.MINIMUM_LIQUIDITY();
      expect(await this.token.balanceOf(this.pair.address)).to.be.equal(ethers.utils.parseEther('1'));
      expect(await this.amm.weth.balanceOf(this.pair.address)).to.be.equal(ethers.utils.parseEther('1'));
      expect(await this.pair.balanceOf('0x000000000000000000000000000000000000dEaD')).to.be.equal(MINIMUM_LIQUIDITY);
      expect(await this.pair.balanceOf(this.accounts.user.address)).to.be.equal(ethers.utils.parseEther('1').sub(MINIMUM_LIQUIDITY));
    });

  });
});
