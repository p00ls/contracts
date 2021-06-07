const { ethers } = require('hardhat');
const { expect } = require('chai');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then(f => f.deployed());
}

async function attach(name, address) {
  const Contract = await ethers.getContractFactory(name);
  return Contract.attach(address);
}

function hashAllocation({ index, account, amount }) {
  return Buffer.from(ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [index, account, amount]).slice(2), 'hex');
}



describe('AMM', function () {
  beforeEach(async function () {
    this.accounts        = await ethers.getSigners();
    this.accounts.admin  = this.accounts.shift();
    this.accounts.artist = this.accounts.shift();
    this.accounts.user   = this.accounts.shift();
    this.registry        = await deploy('P00lsCreatorRegistry', this.accounts.admin.address, 'P00l Artist Registry', 'P00lAR');
    this.weth            = await deploy('WETH');
    this.factory         = await deploy('P00lsAMMFactory', this.accounts.admin.address);
    this.router          = await deploy('UniswapV2Router02', this.factory.address, this.weth.address);
  });

  it('check', async function () {
    // console.log(await this.factory.template())
  });

  describe('with social token', function () {
    beforeEach(async function () {
      this.allocation = { index: 0, account: this.accounts.user.address, amount: ethers.utils.parseEther('100') };
      const merkletree = new MerkleTree([ hashAllocation(this.allocation) ], keccak256, { sort: true });
      const { wait    } = await this.registry.createToken(this.accounts.artist.address, 'Hadrien Croubois', 'Amxx', merkletree.getHexRoot());
      const { events  } = await wait();
      const { tokenId } = events.find(({ event }) => event === 'Transfer').args;
      this.token = await attach('P00lsCreatorToken', ethers.utils.hexlify(tokenId));
      await this.token.claim(this.allocation.index, this.allocation.account, this.allocation.amount, merkletree.getHexProof(hashAllocation(this.allocation)))
    });

    it('sanity check', async function () {
      expect(await this.token.balanceOf(this.accounts.user.address)).to.be.equal(this.allocation.amount);
    });

    it('add liquidity', async function () {
      await this.token.connect(this.accounts.user).approve(this.router.address, ethers.utils.parseEther('1'));

      await expect(this.factory.createPair(this.weth.address, this.token.address))
        .to.emit(this.factory, 'PairCreated');

      this.pair = await attach('P00lsAMMPair' , await this.factory.getPair(this.weth.address, this.token.address));

      await expect(this.router.connect(this.accounts.user).addLiquidityETH(
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
      expect(await this.weth.balanceOf(this.pair.address)).to.be.equal(ethers.utils.parseEther('1'));
      expect(await this.pair.balanceOf('0x000000000000000000000000000000000000dEaD')).to.be.equal(MINIMUM_LIQUIDITY);
      expect(await this.pair.balanceOf(this.accounts.user.address)).to.be.equal(ethers.utils.parseEther('1').sub(MINIMUM_LIQUIDITY));
    });

  });
});
