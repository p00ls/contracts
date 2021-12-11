const { ethers } = require('hardhat');
const { expect } = require('chai');

const { CONFIG, prepare } = require('../fixture.js');

const value = ethers.utils.parseEther('1');

describe('$00 Token', function () {
  prepare();

  before(async function () {
    this.accounts.user = this.accounts.shift();
  });

  it('Check social token', async function () {
    expect(await this.token.name())
      .to.be.equal('P00ls token');
    expect(await this.token.symbol())
      .to.be.equal('$00');
    expect(await this.token.owner())
      .to.be.equal(this.accounts.admin.address);
    expect(await this.registry.ownerOf(this.token.address))
      .to.be.equal(this.accounts.admin.address);
    expect(await this.registry.tokenURI(this.token.address))
      .to.be.equal(`${CONFIG.registry.baseuri}${ethers.BigNumber.from(this.token.address).toString()}`);

    expect(await this.xToken.name())
      .to.be.equal('xP00ls token');
    expect(await this.xToken.symbol())
      .to.be.equal('x$00');
    expect(await this.xToken.owner())
      .to.be.equal(this.accounts.admin.address);
  });

  describe('Votes counting', function () {
    beforeEach(async function () {
      await this.token.connect(this.accounts.user).delegate(this.accounts.user.address);
    });

    it('support token and xtoken', async function () {
      {
        const tx = await this.token.transfer(this.accounts.user.address, value)

        await network.provider.send('evm_mine');

        expect(await this.token.balanceOf(this.accounts.user.address)).to.be.equal(value);
        expect(await this.xToken.balanceOf(this.accounts.user.address)).to.be.equal(0);
        expect(await this.governance.dao.getVotes(this.accounts.user.address, tx.blockNumber)).to.be.equal(value);
      }
      {
        const tx = await this.xToken.connect(this.accounts.user).deposit(value.div(2));

        await network.provider.send('evm_mine');

        expect(await this.token.balanceOf(this.accounts.user.address)).to.be.equal(value.div(2));
        expect(await this.xToken.balanceOf(this.accounts.user.address)).to.be.equal(value.div(2));
        expect(await this.governance.dao.getVotes(this.accounts.user.address, tx.blockNumber)).to.be.equal(value);
      }
      {
        const tx = await this.token.transfer(this.xToken.address, value);

        await network.provider.send('evm_mine');

        expect(await this.token.balanceOf(this.accounts.user.address)).to.be.equal(value.div(2));
        expect(await this.xToken.balanceOf(this.accounts.user.address)).to.be.equal(value.div(2));
        expect(await this.governance.dao.getVotes(this.accounts.user.address, tx.blockNumber)).to.be.equal(value);
      }
      {
        const tx = await this.xToken.onEscrowRelease(0);

        await network.provider.send('evm_mine');

        expect(await this.token.balanceOf(this.accounts.user.address)).to.be.equal(value.div(2));
        expect(await this.xToken.balanceOf(this.accounts.user.address)).to.be.equal(value.div(2));
        expect(await this.governance.dao.getVotes(this.accounts.user.address, tx.blockNumber)).to.be.equal(value.mul(2));
      }
    });
  });
});
