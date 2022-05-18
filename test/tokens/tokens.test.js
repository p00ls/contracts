const { ethers } = require('hardhat');
const { expect } = require('chai');

const { CONFIG, prepare, utils } = require('../fixture.js');

const value = ethers.utils.parseEther('1');

describe('$Crea Token', function () {
  prepare();

  before(async function () {
    this.accounts.reserve = this.accounts.shift();
    this.accounts.artist  = this.accounts.shift();
    this.accounts.user    = this.accounts.shift();
    this.accounts.other   = this.accounts.shift();
  });

  it('check', async function () {
    expect(await this.registry.owner()).to.be.equal(this.timelock.address);
    expect(await this.registry.ownerOf(this.registry.address)).to.be.equal(this.timelock.address);
  });

  describe('with collection', function () {
    beforeEach(async function () {
      // Precompute allocations
      this.allocations = [
        // 40% vesting (creator + user)
        {
          account: this.vesting.address,
          amount: CONFIG.extra.DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_DEPLOYER.mul(40).div(100),
        },
        // 10% AMM (+ dutch auction)
        {
          account: this.auction.address,
          amount: CONFIG.extra.DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_DEPLOYER.mul(10).div(100),
        },
        // 50% staking & liquidity mining - TODO
        {
          account: this.accounts.reserve.address,
          amount: CONFIG.extra.DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_DEPLOYER.mul(50).div(100),
        },
      ].map((obj, index) => Object.assign(obj, { index }));

      // Construct merkletree
      this.merkletree    = utils.merkle.createMerkleTree(this.allocations.map(utils.merkle.hashAllocation));
      this.creatorToken  = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', '$Amxx', 'X Hadrien Croubois', 'x$Amxx', this.merkletree.getRoot());
      this.xCreatorToken = await this.workflows.getXCreatorToken(this.creatorToken);
    });

    describe('Check state', function () {
      it('Creator registry', async function () {
        expect(await this.registry.name())
          .to.be.equal(CONFIG.contracts.registry.name);
        expect(await this.registry.symbol())
          .to.be.equal(CONFIG.contracts.registry.symbol);
        expect(await this.registry.owner())
          .to.be.equal(this.timelock.address);

        expect(await this.registry.ownerOf(this.registry.address))
          .to.be.equal(this.timelock.address);
        expect(await this.registry.tokenURI(this.registry.address))
          .to.be.equal(`${CONFIG.contracts.registry.baseuri}${ethers.BigNumber.from(this.registry.address).toString()}`);
        expect(await this.registry.admin())
          .to.be.equal(this.timelock.address);

        expect(await this.registry.ownerOf(this.creatorToken.address))
          .to.be.equal(this.accounts.artist.address);
        expect(await this.registry.tokenURI(this.creatorToken.address))
          .to.be.equal(`${CONFIG.contracts.registry.baseuri}${ethers.BigNumber.from(this.creatorToken.address).toString()}`);
        expect(await this.creatorToken.admin())
          .to.be.equal(this.timelock.address);
      });

      it('Creator token', async function () {
        expect(await this.creatorToken.name())
          .to.be.equal('Hadrien Croubois');
        expect(await this.creatorToken.symbol())
          .to.be.equal('$Amxx');
        expect(await this.creatorToken.owner())
          .to.be.equal(this.accounts.artist.address);
      });

      it('Creator xToken', async function () {
        expect(await this.xCreatorToken.name())
          .to.be.equal('X Hadrien Croubois');
        expect(await this.xCreatorToken.symbol())
          .to.be.equal('x$Amxx');
        expect(await this.xCreatorToken.owner())
          .to.be.equal(this.accounts.artist.address);
      });
    });

    describe('Metadata', function () {
      describe('registry', function () {
        it('Authorized', async function () {
          await expect(this.registry.connect(this.accounts.superAdmin).setBaseURI('http://some-base-uri/'))
            .to.be.not.reverted;

          expect(await this.registry.tokenURI(this.creatorToken.address))
            .to.be.equal(`http://some-base-uri/${ethers.BigNumber.from(this.creatorToken.address).toString()}`);
        });

        it('Protected', async function () {
          await expect(this.registry.connect(this.accounts.artist).setBaseURI('http://not-a-valid-uri/'))
            .to.be.reverted;
        });
      });

      describe('creatorToken', function () {
        it('Authorized', async function () {
          await expect(this.creatorToken.connect(this.accounts.artist).setTokenURI('http://some-uri/'))
            .to.be.not.reverted;

          expect(await this.creatorToken.tokenURI())
            .to.be.equal('http://some-uri/');
        });

        it('Protected', async function () {
          await expect(this.creatorToken.connect(this.accounts.superAdmin).setTokenURI('http://not-a-valid-uri/'))
            .to.be.reverted;
        });
      });

      describe('xCreatorToken', function () {
        it('Authorized', async function () {
          await expect(this.xCreatorToken.connect(this.accounts.artist).setTokenURI('http://some-uri/'))
            .to.be.not.reverted;

          expect(await this.xCreatorToken.tokenURI())
            .to.be.equal('http://some-uri/');
        });

        it('Protected', async function () {
          await expect(this.xCreatorToken.connect(this.accounts.superAdmin).setTokenURI('http://not-a-valid-uri/'))
            .to.be.reverted;
        });
      });
    });

    describe('Transfer ownership', function () {
      describe('Creator registry', function () {
        it('Protected', async function () {
          await expect(this.registry.connect(this.accounts.other).transferOwnership(this.accounts.other.address))
          .to.be.revertedWith('RegistryOwnable: caller is not the owner');
        });

        it('Authorized', async function () {
          await expect(this.registry.connect(this.accounts.superAdmin).transferOwnership(this.accounts.other.address))
          .to.emit(this.registry, 'Transfer').withArgs(this.accounts.superAdmin.address, this.accounts.other.address, this.registry.address);
        });
      });

      describe('Creator token', function () {
        it('Protected', async function () {
          await expect(this.creatorToken.connect(this.accounts.other).transferOwnership(this.accounts.other.address))
          .to.be.revertedWith('RegistryOwnable: caller is not the owner');
        });

        it('Authorized', async function () {
          await expect(this.creatorToken.connect(this.accounts.artist).transferOwnership(this.accounts.other.address))
          .to.emit(this.registry, 'Transfer').withArgs(this.accounts.artist.address, this.accounts.other.address, this.creatorToken.address);
        });
      });
    });

    describe('Claiming', function () {
      it('protected against invalid proof and replay', async function () {
        for (const allocation of this.allocations) {
          const proof = this.merkletree.getHexProof(utils.merkle.hashAllocation(allocation));

          expect(await this.creatorToken.isClaimed(allocation.index)).to.be.false;

          await expect(this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, []))
          .to.be.revertedWith('P00lsTokenCreator::claim: invalid merkle proof');

          await expect(this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, proof))
          .to.emit(this.creatorToken, 'Transfer')
          .withArgs(ethers.constants.AddressZero, allocation.account, allocation.amount);

          await expect(this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, proof))
          .to.be.revertedWith('P00lsTokenCreator::claim: drop already claimed');

          expect(await this.creatorToken.isClaimed(allocation.index)).to.be.true;
        }
      });
    });

    describe('Delegation', function () {
      it('delegate on creator affect xcreator', async function () {
        await expect(this.creatorToken.connect(this.accounts.user).delegate(this.accounts.other.address))
        .to.emit(this.creatorToken,  'DelegateChanged').withArgs(this.accounts.user.address, ethers.constants.AddressZero, this.accounts.other.address)
        .to.emit(this.xCreatorToken, 'DelegateChanged').withArgs(this.accounts.user.address, ethers.constants.AddressZero, this.accounts.other.address);
      });

      it('delegation hook is protected', async function () {
        await expect(this.xCreatorToken.connect(this.accounts.user).__delegate(this.accounts.user.address, this.accounts.other.address))
        .to.be.revertedWith('P00lsTokenXCreator: creator token restricted');
      });

      it('delegation on xcreator is disabled', async function () {
        await expect(this.xCreatorToken.connect(this.accounts.user).delegate(this.accounts.other.address))
        .to.be.revertedWith('P00lsTokenXCreator: delegation is registered on the creatorToken')

        await expect(this.xCreatorToken.connect(this.accounts.user).delegateBySig(this.accounts.other.address, 0, 0, 0, ethers.constants.HashZero, ethers.constants.HashZero))
        .to.be.revertedWith('P00lsTokenXCreator: delegation is registered on the creatorToken')
      });
    });

    describe('ERC1363', function () {
      beforeEach(async function () {
        this.receiver = await utils.deploy('ERC1363ReceiverMock');

        await Promise.all(this.allocations.map(allocation => this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, this.merkletree.getHexProof(utils.merkle.hashAllocation(allocation)))));
        await this.creatorToken.connect(this.accounts.reserve).transfer(this.accounts.user.address, value);
      });

      describe('transferAndCall', function () {
        it('without data', async function () {
          const data = '0x';

          await expect(this.creatorToken.connect(this.accounts.user).functions['transferAndCall(address,uint256)'](this.receiver.address, value))
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.user.address, this.receiver.address, value)
          .to.emit(this.receiver, 'TransferReceived').withArgs(this.accounts.user.address, this.accounts.user.address, value, data);
        });

        it('with data', async function () {
          const data = '0x123456';

          await expect(this.creatorToken.connect(this.accounts.user).functions['transferAndCall(address,uint256,bytes)'](this.receiver.address, value, data))
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.user.address, this.receiver.address, value)
          .to.emit(this.receiver, 'TransferReceived').withArgs(this.accounts.user.address, this.accounts.user.address, value, data);
        });

        it('with reverting hook', async function () {
          const data = '0x01';

          await expect(this.creatorToken.connect(this.accounts.user).functions['transferAndCall(address,uint256,bytes)'](this.receiver.address, value, data))
          .to.be.revertedWith('onTransferReceived revert');
        });
      });

      describe('transferFromAndCall', function () {
        beforeEach(async function () {
          await this.creatorToken.connect(this.accounts.user).approve(this.accounts.other.address, ethers.constants.MaxUint256);
        });

        it('without data', async function () {
          const data = '0x';

          await expect(this.creatorToken.connect(this.accounts.other).functions['transferFromAndCall(address,address,uint256)'](this.accounts.user.address, this.receiver.address, value))
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.user.address, this.receiver.address, value)
          .to.emit(this.receiver, 'TransferReceived').withArgs(this.accounts.other.address, this.accounts.user.address, value, data);
        });

        it('with data', async function () {
          const data = '0x123456';

          await expect(this.creatorToken.connect(this.accounts.other).functions['transferFromAndCall(address,address,uint256,bytes)'](this.accounts.user.address, this.receiver.address, value, data))
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.user.address, this.receiver.address, value)
          .to.emit(this.receiver, 'TransferReceived').withArgs(this.accounts.other.address, this.accounts.user.address, value, data);
        });

        it('with reverting hook', async function () {
          const data = '0x01';

          await expect(this.creatorToken.connect(this.accounts.other).functions['transferFromAndCall(address,address,uint256,bytes)'](this.accounts.user.address, this.receiver.address, value, data))
          .to.be.revertedWith('onTransferReceived revert');
        });
      });

      describe('approveAndCall', function () {
        it('without data', async function () {
          const data = '0x';

          await expect(this.creatorToken.connect(this.accounts.user).functions['approveAndCall(address,uint256)'](this.receiver.address, value))
          .to.emit(this.creatorToken, 'Approval').withArgs(this.accounts.user.address, this.receiver.address, value)
          .to.emit(this.receiver, 'ApprovalReceived').withArgs(this.accounts.user.address, value, data);
        });

        it('with data', async function () {
          const data = '0x123456';

          await expect(this.creatorToken.connect(this.accounts.user).functions['approveAndCall(address,uint256,bytes)'](this.receiver.address, value, data))
          .to.emit(this.creatorToken, 'Approval').withArgs(this.accounts.user.address, this.receiver.address, value)
          .to.emit(this.receiver, 'ApprovalReceived').withArgs(this.accounts.user.address, value, data);
        });

        it('with reverting hook', async function () {
          const data = '0x01';

          await expect(this.creatorToken.connect(this.accounts.user).functions['approveAndCall(address,uint256,bytes)'](this.receiver.address, value, data))
          .to.be.revertedWith('onApprovalReceived revert');
        });
      });
    });
  });
});
