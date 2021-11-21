const { ethers } = require('hardhat');
const { expect } = require('chai');

const { migrate, attach, utils } = require('../scripts/migrate.js');


const VALUE = ethers.utils.parseEther('100');

describe('Locking', function () {
  before(async function () {
    await migrate().then(env => Object.assign(this, env));
    this.accounts.artist = this.accounts.shift();
    this.accounts.user1  = this.accounts.shift();
    this.accounts.user2  = this.accounts.shift();
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
        { index: 0, account: this.accounts.admin.address, amount: VALUE },
        { index: 1, account: this.accounts.user1.address, amount: VALUE },
        { index: 2, account: this.accounts.user2.address, amount: VALUE },
      ],
      this.merkletree   = utils.merkle.createMerkleTree(this.allocations.map(utils.merkle.hashAllocation));
      this.creatorToken = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', 'Amxx', this.merkletree.getRoot());
      await Promise.all(this.allocations.map(allocation => this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, this.merkletree.getHexProof(utils.merkle.hashAllocation(allocation)))));

      this.id = this.creatorToken.address;
    });

    it('deposit to unset plan', async function () {
      const amount = ethers.utils.parseEther('1');

      await expect(this.creatorToken.connect(this.accounts.user1).approve(this.staking.address, amount))
      .to.be.not.reverted;

      await expect(this.staking.connect(this.accounts.user1).deposit(this.creatorToken.address, amount))
      .to.emit(this.creatorToken, 'Transfer')
      .withArgs(this.accounts.user1.address, this.staking.address, amount)
      .to.emit(this.staking, 'TransferSingle')
      .withArgs(this.accounts.user1.address, ethers.constants.AddressZero, this.accounts.user1.address, this.id, amount);
    });

    describe('with staking plan', function () {
      beforeEach(async function () {
        this.amount = ethers.utils.parseEther('1');
        this.start  = await ethers.provider.getBlock().then(({ timestamp }) => timestamp) + 3600;
        this.middle = this.start                                                          + 1800;
        this.stop   = this.start                                                          + 3600;

        await expect(this.creatorToken.connect(this.accounts.admin).transfer(this.stakingescrow.address, this.amount))
        .to.be.not.reverted;

        await expect(this.stakingescrow.connect(this.accounts.admin).configure(this.creatorToken.address, this.start, this.stop))
        .to.emit(this.stakingescrow, 'NewStaking')
        .withArgs(this.creatorToken.address, this.start, this.stop);
      });

      it('staking details', async function () {
        const details = await this.stakingescrow.manifests(this.id);
        expect(details.enabled   ).to.be.equal(true);
        expect(details.lastUpdate).to.be.equal(ethers.BigNumber.from(this.start));
        expect(details.deadline  ).to.be.equal(ethers.BigNumber.from(this.stop));

        expect(await this.creatorToken.balanceOf(this.staking.address)).to.be.equal(0);
        expect(await this.creatorToken.balanceOf(this.stakingescrow.address)).to.be.equal(this.amount);
      });

      it('reconfigure protected', async function () {
        await expect(this.stakingescrow.connect(this.accounts.admin).configure(this.creatorToken.address, this.start, this.start + 1))
        .to.be.revertedWith('Release schedule already configured')
      });

      describe('deposit & withdraw', function () {
        it('no wait + release half', async function () {
          this.settings = {
            warpTo:   undefined,
            deposit:  ethers.utils.parseEther('10'),
            withdraw: ethers.utils.parseEther('5'),
            release:  ethers.utils.parseEther('0'),
            reward:   ethers.utils.parseEther('0'),
          };
        });

        it('no wait + release all', async function () {
          this.settings = {
            warpTo:   undefined,
            deposit:  ethers.utils.parseEther('10'),
            withdraw: ethers.utils.parseEther('10'),
            release:  ethers.utils.parseEther('0'),
            reward:   ethers.utils.parseEther('0'),
          };
        });

        it('wait start + release half', async function () {
          this.settings = {
            warpTo:   this.start,
            deposit:  ethers.utils.parseEther('10'),
            withdraw: ethers.utils.parseEther('5'),
            release:  ethers.utils.parseEther('0'),
            reward:   ethers.utils.parseEther('0'),
          };
        });

        it('wait start + release all', async function () {
          this.settings = {
            warpTo:   this.start,
            deposit:  ethers.utils.parseEther('10'),
            withdraw: ethers.utils.parseEther('10'),
            release:  ethers.utils.parseEther('0'),
            reward:   ethers.utils.parseEther('0'),
          };
        });

        it('wait halfway + release half', async function () {
          this.settings = {
            warpTo:   this.middle,
            deposit:  ethers.utils.parseEther('10'),
            withdraw: ethers.utils.parseEther('5'),
            release:  this.amount.div(2),
            reward:   this.amount.div(4),
          };
        });

        it('wait halfway + release all', async function () {
          this.settings = {
            warpTo:   this.middle,
            deposit:  ethers.utils.parseEther('10'),
            withdraw: ethers.utils.parseEther('10'),
            release:  this.amount.div(2),
            reward:   this.amount.div(2),
          };
        });

        it('wait stop + release half', async function () {
          this.settings = {
            warpTo:   this.stop,
            deposit:  ethers.utils.parseEther('10'),
            withdraw: ethers.utils.parseEther('5'),
            release:  this.amount,
            reward:   this.amount.div(2),
          };
        });

        it('wait stop + release all', async function () {
          this.settings = {
            warpTo:   this.stop,
            deposit:  ethers.utils.parseEther('10'),
            withdraw: ethers.utils.parseEther('10'),
            release:  this.amount,
            reward:   this.amount,
          };
        });

        afterEach(async function () {
          const {
            warpTo,
            deposit,
            withdraw,
            release,
            reward,
          } = this.settings;

          await expect(this.creatorToken.connect(this.accounts.user1).approve(this.staking.address, deposit))
          .to.be.not.reverted;

          expect(await this.staking.balanceOf(this.accounts.user1.address, this.id)).to.be.equal(0);
          expect(await this.creatorToken.balanceOf(this.accounts.user1.address)).to.be.equal(VALUE);
          expect(await this.creatorToken.balanceOf(this.staking.address)).to.be.equal(0);
          expect(await this.creatorToken.balanceOf(this.stakingescrow.address)).to.be.equal(this.amount);

          await expect(this.staking.connect(this.accounts.user1).deposit(this.creatorToken.address, deposit))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(this.accounts.user1.address, this.staking.address, deposit)
          .to.emit(this.staking, 'TransferSingle')
          .withArgs(this.accounts.user1.address, ethers.constants.AddressZero, this.accounts.user1.address, this.id, deposit);

          expect(await this.staking.balanceOf(this.accounts.user1.address, this.id)).to.be.equal(deposit);
          expect(await this.creatorToken.balanceOf(this.accounts.user1.address)).to.be.equal(VALUE.sub(deposit));
          expect(await this.creatorToken.balanceOf(this.staking.address)).to.be.equal(deposit);
          expect(await this.creatorToken.balanceOf(this.stakingescrow.address)).to.be.equal(this.amount);

          warpTo && await network.provider.send('evm_setNextBlockTimestamp', [ warpTo ]);

          await expect(this.staking.connect(this.accounts.user1).withdraw(this.creatorToken.address, withdraw))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(this.staking.address, this.accounts.user1.address, withdraw.add(reward))
          .to.emit(this.staking, 'TransferSingle')
          .withArgs(this.accounts.user1.address, this.accounts.user1.address, ethers.constants.AddressZero, this.id, withdraw);

          expect(await this.staking.balanceOf(this.accounts.user1.address, this.id)).to.be.equal(deposit.sub(withdraw));
          expect(await this.creatorToken.balanceOf(this.accounts.user1.address)).to.be.equal(VALUE.sub(deposit).add(withdraw).add(reward));
          expect(await this.creatorToken.balanceOf(this.staking.address)).to.be.equal(deposit.sub(withdraw).add(release).sub(reward));
          expect(await this.creatorToken.balanceOf(this.stakingescrow.address)).to.be.equal(this.amount.sub(release));
        });
      });

      describe('multi user', function () {
        // start, wait mid, user 1 deposit, user 1 withdraw
        it('scenario 1', async function () {
          await expect(this.creatorToken.connect(this.accounts.user1).approve(this.staking.address, ethers.constants.MaxUint256)).to.be.not.reverted;
          await expect(this.creatorToken.connect(this.accounts.user2).approve(this.staking.address, ethers.constants.MaxUint256)).to.be.not.reverted;

          await network.provider.send('evm_setNextBlockTimestamp', [ this.middle ]);

          await expect(this.staking.connect(this.accounts.user1).deposit(this.creatorToken.address, ethers.utils.parseEther('1.00')))
          .to.emit(this.staking, 'TransferSingle')
          .withArgs(this.accounts.user1.address, ethers.constants.AddressZero, this.accounts.user1.address, this.id, ethers.utils.parseEther('1.00'));

          await network.provider.send('evm_setNextBlockTimestamp', [ this.stop ]);

          await expect(this.staking.connect(this.accounts.user1).withdraw(this.creatorToken.address, this.staking.balanceOf(this.accounts.user1.address, this.id)))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(this.staking.address, this.accounts.user1.address, ethers.utils.parseEther('2.00'))
        });

        // start, end, user 1 deposit, user 1 withdraw
        it('scenario 2', async function () {
          await expect(this.creatorToken.connect(this.accounts.user1).approve(this.staking.address, ethers.constants.MaxUint256)).to.be.not.reverted;
          await expect(this.creatorToken.connect(this.accounts.user2).approve(this.staking.address, ethers.constants.MaxUint256)).to.be.not.reverted;

          await network.provider.send('evm_setNextBlockTimestamp', [ this.stop ]);

          await expect(this.staking.connect(this.accounts.user1).deposit(this.creatorToken.address, ethers.utils.parseEther('1.00')))
          .to.emit(this.staking, 'TransferSingle')
          .withArgs(this.accounts.user1.address, ethers.constants.AddressZero, this.accounts.user1.address, this.id, ethers.utils.parseEther('1.00'));

          await expect(this.staking.connect(this.accounts.user1).withdraw(this.creatorToken.address, this.staking.balanceOf(this.accounts.user1.address, this.id)))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(this.staking.address, this.accounts.user1.address, ethers.utils.parseEther('2.00'))
        });

        // start, user 1 deposit, wait mid, user 2 deposit, end, user 1 & 2 withdraw
        it('scenario 3a', async function () {
          await expect(this.creatorToken.connect(this.accounts.user1).approve(this.staking.address, ethers.constants.MaxUint256)).to.be.not.reverted;
          await expect(this.creatorToken.connect(this.accounts.user2).approve(this.staking.address, ethers.constants.MaxUint256)).to.be.not.reverted;

          await expect(this.staking.connect(this.accounts.user1).deposit(this.creatorToken.address, ethers.utils.parseEther('1.00')))
          .to.emit(this.staking, 'TransferSingle')
          .withArgs(this.accounts.user1.address, ethers.constants.AddressZero, this.accounts.user1.address, this.id, ethers.utils.parseEther('1.00'));

          await network.provider.send('evm_setNextBlockTimestamp', [ this.middle ]);

          await expect(this.staking.connect(this.accounts.user2).deposit(this.creatorToken.address, ethers.utils.parseEther('1.50')))
          .to.emit(this.staking, 'TransferSingle')
          .withArgs(this.accounts.user2.address, ethers.constants.AddressZero, this.accounts.user2.address, this.id, ethers.utils.parseEther('1.00'));

          await network.provider.send('evm_setNextBlockTimestamp', [ this.stop ]);

          await expect(this.staking.connect(this.accounts.user1).withdraw(this.creatorToken.address, this.staking.balanceOf(this.accounts.user1.address, this.id)))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(this.staking.address, this.accounts.user1.address, ethers.utils.parseEther('1.75')) // 1.00 + 0.50 + 0.25

          await expect(this.staking.connect(this.accounts.user2).withdraw(this.creatorToken.address, this.staking.balanceOf(this.accounts.user2.address, this.id)))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(this.staking.address, this.accounts.user2.address, ethers.utils.parseEther('1.75')) // 1.50 + 0.25
        });

        // start, user 1 deposit, wait mid, user 2 deposit, end, user 1 & 2 withdraw
        it('scenario 3b', async function () {
          await expect(this.creatorToken.connect(this.accounts.user1).approve(this.staking.address, ethers.constants.MaxUint256)).to.be.not.reverted;
          await expect(this.creatorToken.connect(this.accounts.user2).approve(this.staking.address, ethers.constants.MaxUint256)).to.be.not.reverted;

          await expect(this.staking.connect(this.accounts.user1).deposit(this.creatorToken.address, ethers.utils.parseEther('1.00')))
          .to.emit(this.staking, 'TransferSingle')
          .withArgs(this.accounts.user1.address, ethers.constants.AddressZero, this.accounts.user1.address, this.id, ethers.utils.parseEther('1.00'));

          await network.provider.send('evm_setNextBlockTimestamp', [ this.middle ]);

          await expect(this.staking.connect(this.accounts.user2).deposit(this.creatorToken.address, ethers.utils.parseEther('1.00')))
          .to.emit(this.staking, 'TransferSingle')
          .withArgs(this.accounts.user2.address, ethers.constants.AddressZero, this.accounts.user2.address, this.id, ethers.utils.parseEther('0.666666666666666666'));

          await network.provider.send('evm_setNextBlockTimestamp', [ this.stop ]);

          await expect(this.staking.connect(this.accounts.user1).withdraw(this.creatorToken.address, this.staking.balanceOf(this.accounts.user1.address, this.id)))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(this.staking.address, this.accounts.user1.address, ethers.utils.parseEther('1.8')) // 1.00 + 0.50 + 0.3

          await expect(this.staking.connect(this.accounts.user2).withdraw(this.creatorToken.address, this.staking.balanceOf(this.accounts.user2.address, this.id)))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(this.staking.address, this.accounts.user2.address, ethers.utils.parseEther('1.2')) // 1.00 + 0.2
        });

        // start, user 1 deposit, wait start, user2 deposit, wait mid, user 1 deposit more, end, user 1 & 2 withdraw
        it('scenario 4', async function () {
          await expect(this.creatorToken.connect(this.accounts.user1).approve(this.staking.address, ethers.constants.MaxUint256)).to.be.not.reverted;
          await expect(this.creatorToken.connect(this.accounts.user2).approve(this.staking.address, ethers.constants.MaxUint256)).to.be.not.reverted;

          await expect(this.staking.connect(this.accounts.user1).deposit(this.creatorToken.address, ethers.utils.parseEther('1.00')))
          .to.emit(this.staking, 'TransferSingle')
          .withArgs(this.accounts.user1.address, ethers.constants.AddressZero, this.accounts.user1.address, this.id, ethers.utils.parseEther('1.00'));

          await network.provider.send('evm_setNextBlockTimestamp', [ this.start ]);

          await expect(this.staking.connect(this.accounts.user2).deposit(this.creatorToken.address, ethers.utils.parseEther('1.00')))
          .to.emit(this.staking, 'TransferSingle')
          .withArgs(this.accounts.user2.address, ethers.constants.AddressZero, this.accounts.user2.address, this.id, ethers.utils.parseEther('1.00'));

          await network.provider.send('evm_setNextBlockTimestamp', [ this.middle ]);

          // add 1.25 in a pool that has balance 2.5 and supply 2 → 1.0 (interrest compound)
          await expect(this.staking.connect(this.accounts.user1).deposit(this.creatorToken.address, ethers.utils.parseEther('1.25')))
          .to.emit(this.staking, 'TransferSingle')
          .withArgs(this.accounts.user1.address, ethers.constants.AddressZero, this.accounts.user1.address, this.id, ethers.utils.parseEther('1.00'));

          await network.provider.send('evm_setNextBlockTimestamp', [ this.stop ]);

          await expect(this.staking.connect(this.accounts.user1).withdraw(this.creatorToken.address, this.staking.balanceOf(this.accounts.user1.address, this.id)))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(this.staking.address, this.accounts.user1.address, ethers.utils.parseEther('2.833333333333333333')) // 1.00 + 1.25 + 0.25 + 0.333333333333333333

          await expect(this.staking.connect(this.accounts.user2).withdraw(this.creatorToken.address, this.staking.balanceOf(this.accounts.user2.address, this.id)))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(this.staking.address, this.accounts.user2.address, ethers.utils.parseEther('1.416666666666666667')) // 1.000 + 0.25 + 0.166666666666666667
        });
      });
    });
  });
});
