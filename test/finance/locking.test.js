const { ethers } = require('hardhat');
const { expect } = require('chai');

const { CONFIG, prepare, utils } = require('../fixture.js');

const VALUE = ethers.utils.parseEther('100');
const value = ethers.utils.parseEther('1');

describe('Locking', function () {
  prepare();

  before(async function () {
    this.accounts.artist = this.accounts.shift();
    this.accounts.user   = this.accounts.shift();
    this.accounts.other  = this.accounts.shift();
  });

  beforeEach(async function () {
    // allocate pool to the auction manager & give token to user
    await this.token.transfer(this.auction.address, VALUE);
    await this.token.transfer(this.accounts.user.address, VALUE);

    // createtor token with allocation to the auction manager
    this.allocations = [
      { index: 0, account: this.auction.address, amount: VALUE },
      { index: 1, account: this.locking.address, amount: VALUE },
      // { index: 0, account: this.accounts.admin.address, amount: CONFIG.TARGETSUPPLY },
    ],
    this.merkletree    = utils.merkle.createMerkleTree(this.allocations.map(utils.merkle.hashAllocation));
    this.creatorToken  = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', '$Amxx', 'X Hadrien Croubois', 'x$Amxx', this.merkletree.getRoot());
    this.xCreatorToken = await this.workflows.getXCreatorToken(this.creatorToken);
    await Promise.all(this.allocations.map(allocation => this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, this.merkletree.getHexProof(utils.merkle.hashAllocation(allocation)))));

    // check balances
    expect(await this.token.balanceOf(this.auction.address)).to.be.equal(VALUE);
    expect(await this.creatorToken.balanceOf(this.auction.address)).to.be.equal(VALUE);

    // initiate auction
    const { timestamp: now } = await ethers.provider.getBlock('latest');
    this.auction_instance = await this.auction.start(this.creatorToken.address, now, 14 * 86400)
      .then(() => this.auction.getAuctionInstance(this.creatorToken.address))
      .then(address => utils.attach('Auction', address));

    // run auctions
    await this.token.transfer(this.accounts.user.address, value);
    await this.token.connect(this.accounts.user)['transferAndCall(address,uint256)'](this.auction_instance.address, value);
    await network.provider.send('evm_increaseTime', [ 14 * 86400 ]);
    await this.auction.finalize(this.creatorToken.address);

    // withdraw funds
    await this.auction_instance.connect(this.accounts.user).withdraw(this.accounts.user.address);

    // check balances
    expect(await this.token.balanceOf(this.auction.address)).to.be.equal('0');
    expect(await this.token.balanceOf(this.accounts.user.address)).to.be.equal(VALUE);
    expect(await this.creatorToken.balanceOf(this.auction.address)).to.be.equal('0');
    expect(await this.creatorToken.balanceOf(this.accounts.user.address)).to.be.equal(VALUE.div(2));
  });

  describe('before lock setup', function () {
    it('empty lock details', async function () {
      const details = await this.locking.lockDetails(this.creatorToken.address);
      expect(details.start).to.be.equal(0);
      expect(details.rate).to.be.equal(0);
      expect(details.reward).to.be.equal(0);
      expect(details.totalWeight).to.be.equal(0);
    });

    it('empty vault details', async function () {
      const details = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.user.address);
      expect(details.maturity).to.be.equal(0);
      expect(details.value).to.be.equal(0);
      expect(details.extra).to.be.equal(0);
      expect(details.weight).to.be.equal(0);
    });

    it('unauthorized cannot setup lock', async function () {
      await expect(this.locking.connect(this.accounts.other).lockSetup(this.creatorToken.address))
      .to.be.revertedWith(`AccessControl: account ${this.accounts.other.address.toLowerCase()} is missing role ${this.roles.LOCKING_MANAGER}`);
    });

    it('admin can setup lock', async function () {
      await expect(this.locking.connect(this.accounts.admin).lockSetup(this.creatorToken.address))
      .to.emit(this.locking, 'LockSetup').withArgs(this.creatorToken.address);
    });

    it('cannot setup vault', async function () {
      await expect(this.locking.connect(this.accounts.user).vaultSetup(this.creatorToken.address, 12 * 30 * 86400))
      .to.be.revertedWith('Locking not currently authorized for this token');
    });

    it('cannot deposit', async function () {
      await expect(this.locking.connect(this.accounts.user).deposit(this.creatorToken.address, 0, 0))
      .to.be.revertedWith('Locking not currently authorized for this token');
    });

    it('cannot withdraw', async function () {
      await expect(this.locking.connect(this.accounts.user).withdraw(this.creatorToken.address))
      .to.be.revertedWith('Vault is locked');
    });

    describe('after lock setup', function () {
      beforeEach(async function () {
        const tx          = await this.locking.connect(this.accounts.admin).lockSetup(this.creatorToken.address);
        this.start        = await ethers.provider.getBlock(tx.blockNumber).then(({timestamp }) => timestamp);
        this.DELAY        = await this.locking.DELAY();
        this.MIN_DURATION = await this.locking.MIN_DURATION();
        this.MAX_DURATION = await this.locking.MAX_DURATION();
      })

      it('lock details', async function () {
        const details = await this.locking.lockDetails(this.creatorToken.address);
        expect(details.start).to.be.equal(this.DELAY.add(this.start));
        // expect(details.rate).to.be.equal(0);
        expect(details.reward).to.be.equal(VALUE);
        expect(details.totalWeight).to.be.equal(0);
      });

      it('empty vault details', async function () {
        const details = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.user.address);
        expect(details.maturity).to.be.equal(0);
        expect(details.value).to.be.equal(0);
        expect(details.extra).to.be.equal(0);
        expect(details.weight).to.be.equal(0);
      });

      it('cannot re setup lock', async function () {
        await expect(this.locking.connect(this.accounts.admin).lockSetup(this.creatorToken.address))
        .to.be.revertedWith('Locking already configured');
      });

      it('cannot setup vault with invalid duration', async function () {
        await expect(this.locking.connect(this.accounts.user).vaultSetup(this.creatorToken.address, this.MIN_DURATION.sub(1)))
        .to.be.reverted;

        await expect(this.locking.connect(this.accounts.user).vaultSetup(this.creatorToken.address, this.MAX_DURATION.add(1)))
        .to.be.reverted;
      });

      it('can setup vault', async function () {
        const duration = 12 * 30 * 86400;

        await expect(this.locking.connect(this.accounts.user).vaultSetup(this.creatorToken.address, duration))
        .to.emit(this.locking, 'VaultSetup').withArgs(
          this.creatorToken.address,
          this.accounts.user.address,
          this.DELAY.add(this.start).add(duration),
        );
      });

      it('cannot deposit', async function () {
        await expect(this.locking.connect(this.accounts.user).deposit(this.creatorToken.address, 0, 0,))
        .to.be.revertedWith('Vault doesn\'t accept deposit');
      });

      it('cannot withdraw', async function () {
        await expect(this.locking.connect(this.accounts.user).withdraw(this.creatorToken.address))
        .to.be.revertedWith('Vault is locked');
      });

      describe('after vault setup', function () {
        beforeEach(async function () {
          this.duration = 12 * 30 * 86400;
          await this.locking.connect(this.accounts.user).vaultSetup(this.creatorToken.address, this.duration);
          await this.locking.connect(this.accounts.other).vaultSetup(this.creatorToken.address, this.duration / 2);
        })

        it('lock details', async function () {
          const details = await this.locking.lockDetails(this.creatorToken.address);
          expect(details.start).to.be.equal(this.DELAY.add(this.start));
          // expect(details.rate).to.be.equal(0);
          expect(details.reward).to.be.equal(VALUE);
          expect(details.totalWeight).to.be.equal(0);
        });

        it('vault details', async function () {
          const details = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.user.address);
          expect(details.maturity).to.be.equal(this.DELAY.add(this.start).add(this.duration));
          expect(details.value).to.be.equal(0);
          expect(details.extra).to.be.equal(0);
          expect(details.weight).to.be.equal(0);
        });

        it('more vault details', async function () {
          const details = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.other.address);
          expect(details.maturity).to.be.equal(this.DELAY.add(this.start).add(this.duration / 2));
          expect(details.value).to.be.equal(0);
          expect(details.extra).to.be.equal(0);
          expect(details.weight).to.be.equal(0);
        });

        it('cannot re setup lock', async function () {
          await expect(this.locking.connect(this.accounts.admin).lockSetup(this.creatorToken.address))
          .to.be.revertedWith('Locking already configured');
        });

        it('cannot re setup vault', async function () {
          await expect(this.locking.connect(this.accounts.user).vaultSetup(this.creatorToken.address, this.duration))
          .to.be.revertedWith('Vault already configured');
        });

        it('can deposit', async function () {
          await this.token.connect(this.accounts.user).approve(this.locking.address, ethers.constants.MaxUint256);
          await this.creatorToken.connect(this.accounts.user).approve(this.locking.address, ethers.constants.MaxUint256);

          const tx     = await this.locking.connect(this.accounts.user).depositFor(this.creatorToken.address, value, value.div(2), this.accounts.other.address);
          const weight = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.other.address).then(({ weight }) => weight);

          await expect(tx)
          .to.emit(this.token, 'Transfer').withArgs(this.accounts.user.address, this.locking.address, value.div(2))
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.user.address, this.locking.address, value)
          .to.emit(this.locking, 'Deposit').withArgs(this.creatorToken.address, this.accounts.other.address, value, value.div(2), weight);
        });

        it('can deposit creator token with erc1363\'s transferAndCall', async function () {
          const tx = await this.creatorToken.connect(this.accounts.user).functions['transferAndCall(address,uint256,bytes)'](
            this.locking.address,
            value,
            ethers.utils.defaultAbiCoder.encode([ 'address', 'address' ],[ this.creatorToken.address, this.accounts.other.address ]),
          );
          const weight = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.other.address).then(({ weight }) => weight);

          await expect(tx)
          .to.emit(this.locking, 'Deposit').withArgs(this.creatorToken.address, this.accounts.other.address, value, 0, weight)
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.user.address, this.locking.address, value)
          .to.not.emit(this.creatorToken, 'Approval');
        });

        it('can deposit extra token with erc1363\'s transferAndCall', async function () {
          const tx = await this.token.connect(this.accounts.user).functions['transferAndCall(address,uint256,bytes)'](
            this.locking.address,
            value.div(2),
            ethers.utils.defaultAbiCoder.encode([ 'address', 'address' ],[ this.creatorToken.address, this.accounts.other.address ]),
          );
          const weight = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.other.address).then(({ weight }) => weight);

          await expect(tx)
          .to.emit(this.locking, 'Deposit').withArgs(this.creatorToken.address, this.accounts.other.address, 0, value.div(2), weight)
          .to.emit(this.token, 'Transfer').withArgs(this.accounts.user.address, this.locking.address, value.div(2))
          .to.not.emit(this.creatorToken, 'Approval');
        });

        it('can deposit creator token with erc1363\'s approveAndCall', async function () {
          const tx = await this.creatorToken.connect(this.accounts.user).functions['approveAndCall(address,uint256,bytes)'](
            this.locking.address,
            value,
            ethers.utils.defaultAbiCoder.encode([ 'address', 'address' ],[ this.creatorToken.address, this.accounts.other.address ]),
          );
          const weight = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.other.address).then(({ weight }) => weight);

          await expect(tx)
          .to.emit(this.locking, 'Deposit').withArgs(this.creatorToken.address, this.accounts.other.address, value, 0, weight)
          .to.emit(this.creatorToken, 'Approval').withArgs(this.accounts.user.address, this.locking.address, value)
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.user.address, this.locking.address, value)
          .to.emit(this.creatorToken, 'Approval').withArgs(this.accounts.user.address, this.locking.address, 0);
        });

        it('can deposit extra token with erc1363\'s approveAndCall', async function () {
          const tx = await this.token.connect(this.accounts.user).functions['approveAndCall(address,uint256,bytes)'](
            this.locking.address,
            value.div(2),
            ethers.utils.defaultAbiCoder.encode([ 'address', 'address' ],[ this.creatorToken.address, this.accounts.other.address ]),
          );
          const weight = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.other.address).then(({ weight }) => weight);

          await expect(tx)
          .to.emit(this.locking, 'Deposit').withArgs(this.creatorToken.address, this.accounts.other.address, 0, value.div(2), weight)
          .to.emit(this.token, 'Approval').withArgs(this.accounts.user.address, this.locking.address, value.div(2))
          .to.emit(this.token, 'Transfer').withArgs(this.accounts.user.address, this.locking.address, value.div(2))
          .to.emit(this.token, 'Approval').withArgs(this.accounts.user.address, this.locking.address, 0);
        });

        it('protected against invalid erc1363\'s calls', async function () {
          await expect(this.locking.onTransferReceived(
            this.accounts.user.address,
            this.accounts.user.address,
            value,
            ethers.utils.defaultAbiCoder.encode([ 'address', 'address' ],[ this.creatorToken.address, this.accounts.other.address ]),
          ))
          .to.be.revertedWith('invalid data');

          await expect(this.locking.onApprovalReceived(
            this.accounts.user.address,
            value,
            ethers.utils.defaultAbiCoder.encode([ 'address', 'address' ],[ this.creatorToken.address, this.accounts.other.address ]),
          ))
          .to.be.revertedWith('invalid data');
        });

        it('cannot withdraw', async function () {
          await expect(this.locking.connect(this.accounts.user).withdraw(this.creatorToken.address))
          .to.be.revertedWith('Vault is locked');
        });

        describe('after deposit', function () {
          beforeEach(async function () {
            await Promise.all([ this.token, this.creatorToken ].flatMap(token => [
              token.connect(this.accounts.user).transfer(this.accounts.other.address, value),
              token.connect(this.accounts.user).approve(this.locking.address, ethers.constants.MaxUint256),
              token.connect(this.accounts.other).approve(this.locking.address, ethers.constants.MaxUint256),
            ]));

            await Promise.all([ this.accounts.user, this.accounts.other ].flatMap(account => [
              this.locking.connect(account).deposit(this.creatorToken.address, value, value.div(2)),
            ]));
          });

          it('check status', async function () {
            const userDetails  = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.user.address);
            const otherDetails = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.other.address);

            expect(userDetails.maturity).to.be.equal(this.DELAY.add(this.start).add(this.duration));
            expect(userDetails.value).to.be.equal(value);
            expect(userDetails.extra).to.be.equal(value.div(2));
            // expect(userDetails.weight).to.be.equal();
            expect(otherDetails.maturity).to.be.equal(this.DELAY.add(this.start).add(this.duration / 2));
            expect(otherDetails.value).to.be.equal(value);
            expect(otherDetails.extra).to.be.equal(value.div(2));
            // expect(otherDetails.weight).to.be.equal();
            expect(userDetails.weight).to.be.gt(otherDetails.weight);
          });

          it('can deposit more', async function () {
            const oldWeight = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.user.address).then(({ weight }) => weight);
            const tx        = await this.locking.connect(this.accounts.user).deposit(this.creatorToken.address, value, 0);
            const newWeight = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.user.address).then(({ weight }) => weight);

            await expect(tx)
            .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.user.address, this.locking.address, value)
            .to.emit(this.locking, 'Deposit').withArgs(this.creatorToken.address, this.accounts.user.address, value, 0, newWeight)
            .to.not.emit(this.token, 'Transfer');

            expect(newWeight).to.be.gt(oldWeight);
          });

          it('can deposit more extra', async function () {
            const oldWeight = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.user.address).then(({ weight }) => weight);
            const tx        = await this.locking.connect(this.accounts.user).deposit(this.creatorToken.address, 0, value.div(2));
            const newWeight = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.user.address).then(({ weight }) => weight);

            await expect(tx)
            .to.emit(this.token, 'Transfer').withArgs(this.accounts.user.address, this.locking.address, value.div(2))
            .to.emit(this.locking, 'Deposit').withArgs(this.creatorToken.address, this.accounts.user.address, 0, value.div(2), newWeight)
            .to.not.emit(this.creatorToken, 'Transfer');

            expect(newWeight).to.be.gt(oldWeight);
          });

          it('cannot withdraw', async function () {
            await expect(this.locking.connect(this.accounts.user).withdraw(this.creatorToken.address))
            .to.be.revertedWith('Vault is locked');
          });

          describe('after delay', function () {
            beforeEach(async function () {
              await network.provider.send('evm_increaseTime', [ this.DELAY.toNumber() ]);
            });

            it('cannot deposit anymore', async function () {
              await expect(this.locking.connect(this.accounts.user).deposit(this.creatorToken.address, value, 0))
              .to.be.revertedWith('Locking not currently authorized for this token');
            });

            it('cannot withdraw', async function () {
              await expect(this.locking.connect(this.accounts.user).withdraw(this.creatorToken.address))
              .to.be.revertedWith('Vault is locked');
            });

            describe('after expiration', function () {
              beforeEach(async function () {
                await network.provider.send('evm_increaseTime', [ this.duration ]);
              });

              it('can withdraw to someone else', async function () {
                const tx     = await this.locking.connect(this.accounts.user).withdrawTo(this.creatorToken.address, this.accounts.other.address);
                const reward = await tx.wait().then(({ events }) => events.find(({ event }) => event == 'Withdraw').args.reward);

                await expect(tx)
                .to.emit(this.locking, 'Withdraw').withArgs(this.creatorToken.address, this.accounts.user.address, this.accounts.other.address, reward)
                .to.emit(this.token, 'Transfer').withArgs(this.locking.address, this.accounts.other.address, value.div(2))
                .to.emit(this.creatorToken, 'Transfer').withArgs(this.locking.address, this.accounts.other.address, value.add(reward));
              });

              it('relative withdraw', async function () {
                const tx1     = await this.locking.connect(this.accounts.other).withdraw(this.creatorToken.address);
                const reward1 = await tx1.wait().then(({ events }) => events.find(({ event }) => event == 'Withdraw').args.reward);

                await expect(tx1)
                .to.emit(this.locking, 'Withdraw').withArgs(this.creatorToken.address, this.accounts.other.address, this.accounts.other.address, reward1)
                .to.emit(this.token, 'Transfer').withArgs(this.locking.address, this.accounts.other.address, value.div(2))
                .to.emit(this.creatorToken, 'Transfer').withArgs(this.locking.address, this.accounts.other.address, value.add(reward1));

                const tx2     = await this.locking.connect(this.accounts.user).withdraw(this.creatorToken.address);
                const reward2 = await tx2.wait().then(({ events }) => events.find(({ event }) => event == 'Withdraw').args.reward);

                await expect(tx2)
                .to.emit(this.locking, 'Withdraw').withArgs(this.creatorToken.address, this.accounts.user.address, this.accounts.user.address, reward2)
                .to.emit(this.token, 'Transfer').withArgs(this.locking.address, this.accounts.user.address, value.div(2))
                .to.emit(this.creatorToken, 'Transfer').withArgs(this.locking.address, this.accounts.user.address, value.add(reward2));

                expect(reward1).to.be.gt(0);
                expect(reward2).to.be.gt(reward1);
              });
            });
          });
        });
      });
    });
  });

  describe('Duration', function () {
    for (const months of new Array(12).fill().map((_, i) => (i + 1) * 3)) {
      it(`${months} months`, async function () {
        await expect(this.creatorToken.connect(this.accounts.user).approve(this.locking.address, ethers.constants.MaxUint256))
        .to.be.not.reverted;

        const tx1 = await this.locking.lockSetup(
          this.creatorToken.address,
        );

        const tx2 = await this.locking.connect(this.accounts.user).vaultSetup(
          this.creatorToken.address,
          months * 30 * 86400,
        );

        const tx3 = await this.locking.connect(this.accounts.user).deposit(
          this.creatorToken.address,
          VALUE.div(100), // value
          0, // no extra
        );

        const lockDetails  = await this.locking.lockDetails(this.creatorToken.address);
        const vaultDetails = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.user.address);

        const timestamp = await ethers.provider.getBlock(tx1.blockNumber).then(({ timestamp }) => timestamp);
        const start     = timestamp +          30 * 86400
        const maturity  = start     + months * 30 * 86400
        expect(lockDetails.start).to.be.equal(start);
        expect(lockDetails.reward).to.be.equal(VALUE);
        expect(vaultDetails.maturity).to.be.equal(maturity);
        expect(vaultDetails.value).to.be.equal(VALUE.div(100));
        expect(vaultDetails.extra).to.be.equal(0);
        expect(lockDetails.totalWeight).to.be.equal(vaultDetails.weight);

        // console.log(months, vaultDetails.weight.toString())
      });
    }
  });

  describe('Extra', function () {
    for (const factor of new Array(10).fill().map((_, i) => i)) {
      it(`factor ${factor}`, async function () {
        await expect(this.token.connect(this.accounts.user).approve(this.locking.address, ethers.constants.MaxUint256))
        .to.be.not.reverted;
        await expect(this.creatorToken.connect(this.accounts.user).approve(this.locking.address, ethers.constants.MaxUint256))
        .to.be.not.reverted;

        const tx1 = await this.locking.lockSetup(
          this.creatorToken.address,
        );

        const tx2 = await this.locking.connect(this.accounts.user).vaultSetup(
          this.creatorToken.address,
          3 * 30 * 86400,
        );

        const tx3 = await this.locking.connect(this.accounts.user).deposit(
          this.creatorToken.address,
          VALUE.div(100),             // value
          VALUE.div(100).mul(factor), // extra
        );

        const lockDetails  = await this.locking.lockDetails(this.creatorToken.address);
        const vaultDetails = await this.locking.vaultDetails(this.creatorToken.address, this.accounts.user.address);

        const timestamp = await ethers.provider.getBlock(tx1.blockNumber).then(({ timestamp }) => timestamp);
        const start     = timestamp +     30 * 86400
        const maturity  = start     + 3 * 30 * 86400
        expect(lockDetails.start).to.be.equal(start);
        expect(lockDetails.reward).to.be.equal(VALUE);
        expect(vaultDetails.maturity).to.be.equal(maturity);
        expect(vaultDetails.value).to.be.equal(VALUE.div(100));
        expect(vaultDetails.extra).to.be.equal(VALUE.div(100).mul(factor));
        expect(lockDetails.totalWeight).to.be.equal(vaultDetails.weight);

        // console.log(factor, vaultDetails.weight.toString())
      });
    }
  });
});
