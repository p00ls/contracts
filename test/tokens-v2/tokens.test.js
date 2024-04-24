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
    expect(await this.v2.registry.owner()).to.be.equal(this.accounts.admin.address);
    expect(await this.v2.registry.ownerOf(this.v2.registry.address)).to.be.equal(this.accounts.admin.address);
  });

  describe('with collection', function () {
    beforeEach(async function () {
      // Precompute allocations
      this.allocations = [
        // 40% vesting (creator + user)
        {
          account: this.vestedAirdrop.address,
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
      this.merkletree   = utils.merkle.createMerkleTree(this.allocations.map(utils.merkle.hashAllocation));
      this.creatorToken = await this.v2.workflows.newToken(this.accounts.artist.address, 'Hadrien Croubois', '$Amxx', this.merkletree.getRoot());
    });

    describe('Check state', function () {
      it('Creator registry', async function () {
        expect(await this.v2.registry.name())
          .to.be.equal(CONFIG.contracts.registry.name);
        expect(await this.v2.registry.symbol())
          .to.be.equal(CONFIG.contracts.registry.symbol);
        expect(await this.v2.registry.owner())
          .to.be.equal(this.accounts.admin.address);

        expect(await this.v2.registry.ownerOf(this.v2.registry.address))
          .to.be.equal(this.accounts.admin.address);
        expect(await this.v2.registry.tokenURI(this.v2.registry.address))
          .to.be.equal(`${CONFIG.contracts.registry.baseuri}${ethers.BigNumber.from(this.v2.registry.address).toString()}`);
        expect(await this.v2.registry.admin())
          .to.be.equal(this.accounts.admin.address);

        expect(await this.v2.registry.ownerOf(this.creatorToken.address))
          .to.be.equal(this.accounts.artist.address);
        expect(await this.v2.registry.tokenURI(this.creatorToken.address))
          .to.be.equal(`${CONFIG.contracts.registry.baseuri}${ethers.BigNumber.from(this.creatorToken.address).toString()}`);
        expect(await this.creatorToken.admin())
          .to.be.equal(this.accounts.admin.address);
      });

      it('Creator token', async function () {
        expect(await this.creatorToken.name())
          .to.be.equal('Hadrien Croubois');
        expect(await this.creatorToken.symbol())
          .to.be.equal('$Amxx');
        expect(await this.creatorToken.owner())
          .to.be.equal(this.accounts.artist.address);
      });
    });

    describe('Metadata', function () {
      describe('registry', function () {
        it('Authorized', async function () {
          await expect(this.v2.registry.connect(this.accounts.admin).setBaseURI('http://some-base-uri/'))
            .to.be.not.reverted;

          expect(await this.v2.registry.tokenURI(this.creatorToken.address))
            .to.be.equal(`http://some-base-uri/${ethers.BigNumber.from(this.creatorToken.address).toString()}`);
        });

        it('Protected', async function () {
          await expect(this.v2.registry.connect(this.accounts.artist).setBaseURI('http://not-a-valid-uri/'))
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
          await expect(this.creatorToken.connect(this.accounts.admin).setTokenURI('http://not-a-valid-uri/'))
            .to.be.reverted;
        });
      });
    });

    describe('Transfer ownership', function () {
      describe('Creator registry', function () {
        it('Protected', async function () {
          await expect(this.v2.registry.connect(this.accounts.other).transferOwnership(this.accounts.other.address))
          .to.be.revertedWith('RegistryOwnable: caller is not the owner');
        });

        it('Authorized', async function () {
          await expect(this.v2.registry.connect(this.accounts.admin).transferOwnership(this.accounts.other.address))
          .to.emit(this.v2.registry, 'Transfer').withArgs(this.accounts.admin.address, this.accounts.other.address, this.v2.registry.address);
        });

        it('Through NFT', async function () {
          expect(await this.v2.registry.owner()).to.be.equal(this.accounts.admin.address);

          await expect(this.v2.registry.connect(this.accounts.admin).transferFrom(this.accounts.admin.address, this.accounts.other.address, this.v2.registry.address))
          .to.emit(this.v2.registry, 'Transfer').withArgs(this.accounts.admin.address, this.accounts.other.address, this.v2.registry.address);

          expect(await this.v2.registry.owner()).to.be.equal(this.accounts.other.address);
        });
      });

      describe('Creator token', function () {
        it('Protected', async function () {
          await expect(this.creatorToken.connect(this.accounts.other).transferOwnership(this.accounts.other.address))
          .to.be.revertedWith('RegistryOwnable: caller is not the owner');
        });

        it('Authorized', async function () {
          await expect(this.creatorToken.connect(this.accounts.artist).transferOwnership(this.accounts.other.address))
          .to.emit(this.v2.registry, 'Transfer').withArgs(this.accounts.artist.address, this.accounts.other.address, this.creatorToken.address);
        });

        it('Through NFT', async function () {
          expect(await this.creatorToken.owner()).to.be.equal(this.accounts.artist.address);

          await expect(this.v2.registry.connect(this.accounts.artist).transferFrom(this.accounts.artist.address, this.accounts.other.address, this.creatorToken.address))
          .to.emit(this.v2.registry, 'Transfer').withArgs(this.accounts.artist.address, this.accounts.other.address, this.creatorToken.address);

          expect(await this.creatorToken.owner()).to.be.equal(this.accounts.other.address);
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

    describe('whitelist', function () {
      beforeEach(async function () {
        // add admin to whitelist
        await this.creatorToken.connect(this.accounts.artist).grantRole(this.roles.WHITELISTED, this.accounts.admin.address);
      });

      it('token is closed by default', async function () {
        expect(await this.creatorToken.isOpen()).to.be.false;
      });

      describe('closed', function () {
        it('open is restricted', async function () {
          await expect(this.creatorToken.connect(this.accounts.other).open()).to.be.revertedWith('RegistryOwnable: caller is not the owner');
        });

        it('whitelisted → non whitelisted: ok', async function () {
          await expect(this.creatorToken.transferFrom(this.accounts.admin.address, this.accounts.other.address, 0))
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.admin.address, this.accounts.other.address, 0);
        });

        it('non whitelisted → whitelisted: ok', async function () {
          await expect(this.creatorToken.transferFrom(this.accounts.other.address, this.accounts.admin.address, 0))
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.other.address, this.accounts.admin.address, 0);
        });

        it('non whitelisted → non whitelisted: revert', async function () {
          await expect(this.creatorToken.transferFrom(this.accounts.other.address, this.accounts.other.address, 0))
          .to.be.revertedWith('Transfer restricted to whitelisted');
        });
      });

      describe('open', function () {
        beforeEach(async function () {
          expect(await this.creatorToken.connect(this.accounts.artist).open()).to.emit(this.creatorToken, 'Opened');
        });

        it('flag is set', async function () {
          expect(await this.creatorToken.isOpen()).to.be.true;
        });

        it('whitelisted → non whitelisted: ok', async function () {
          await expect(this.creatorToken.transferFrom(this.accounts.admin.address, this.accounts.other.address, 0))
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.admin.address, this.accounts.other.address, 0);
        });

        it('non whitelisted → whitelisted: ok', async function () {
          await expect(this.creatorToken.transferFrom(this.accounts.other.address, this.accounts.admin.address, 0))
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.other.address, this.accounts.admin.address, 0);
        });

        it('non whitelisted → non whitelisted: ok', async function () {
          await expect(this.creatorToken.transferFrom(this.accounts.other.address, this.accounts.other.address, 0))
          .to.emit(this.creatorToken, 'Transfer').withArgs(this.accounts.other.address, this.accounts.other.address, 0);
        });
      });
    });

    describe('ERC1363', function () {
      beforeEach(async function () {
        this.receiver = await utils.deploy('ERC1363ReceiverMock');

        await this.creatorToken.connect(this.accounts.artist).open();
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

    describe('detach upgradeability', function () {
      it('by default, upgradeability affects token', async function () {
        await expect(this.creatorToken.isOpen()).to.be.not.reverted;

        // breaking upgrade
        await this.v2.registry.connect(this.accounts.admin).upgradeTokens(this.v2.registry.address);

        await expect(this.creatorToken.isOpen()).to.be.reverted;
      });

      it('owner can lock upgradeability for its token', async function () {
        const ERC1967IMPLEMENTATION = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

        await expect(this.creatorToken.isOpen()).to.be.not.reverted;

        expect(await ethers.provider.getStorageAt(this.creatorToken.address, ERC1967IMPLEMENTATION).then(slot => ethers.utils.getAddress(slot.slice(-40))))
        .to.be.equal(this.v2.registry.address);

        // Lock
        await expect(this.creatorToken.connect(this.accounts.artist).detachUpgradeability())
          .to.emit(this.creatorToken, 'Upgraded').withArgs(this.v2.tokenImpl.address);

        expect(await ethers.provider.getStorageAt(this.creatorToken.address, ERC1967IMPLEMENTATION).then(slot => ethers.utils.getAddress(slot.slice(-40))))
          .to.be.equal(this.v2.tokenImpl.address);

        // breaking upgrade
        await this.v2.registry.connect(this.accounts.admin).upgradeTokens(this.v2.registry.address);

        await expect(this.creatorToken.isOpen()).to.be.not.reverted;
      });

      it('re-detach reverts', async function () {
        await this.creatorToken.connect(this.accounts.artist).detachUpgradeability();
        await expect(this.creatorToken.connect(this.accounts.artist).detachUpgradeability())
          .to.be.revertedWith('Implementation already detached');
      });
    });

    describe('access control', function () {
      describe('token', function () {
        it('reinitialize', async function () {
          await expect(this.creatorToken.initialize('otherName', 'otherSymbol', ethers.constants.HashZero))
            .to.be.revertedWith('InvalidInitialization()');
        });

        it('detach', async function () {
          await expect(this.creatorToken.connect(this.accounts.other).detachUpgradeability())
            .to.be.revertedWith('RegistryOwnable: caller is not the owner');
        });
      });

      describe('registry', function () {
        it('reinitialize', async function () {
          await expect(this.v2.registry.initialize(this.accounts.other.address, 'otherName', 'otherSymbol'))
            .to.be.revertedWith('InvalidInitialization()');
        });

        it('createToken', async function () {
          await expect(this.v2.registry.connect(this.accounts.other).createToken(this.accounts.other.address, 'name', 'symbol', ethers.constants.HashZero))
            .to.be.revertedWith(`AccessControlUnauthorizedAccount("${this.accounts.other.address}", "${this.roles.REGISTRY_MANAGER}")`);
        });

        it('createToken2', async function () {
          await expect(this.v2.registry.connect(this.accounts.other).createToken2(this.accounts.other.address, 'name', 'symbol', ethers.constants.HashZero))
            .to.be.revertedWith(`AccessControlUnauthorizedAccount("${this.accounts.other.address}", "${this.roles.REGISTRY_MANAGER}")`);
        });

        it('upgradeTokens', async function () {
          await expect(this.v2.registry.connect(this.accounts.other).upgradeTokens(this.v2.tokenImpl.address))
            .to.be.revertedWith(`AccessControlUnauthorizedAccount("${this.accounts.other.address}", "${this.roles.UPGRADER}")`);
        });

        it('upgrade', async function () {
          await expect(this.v2.registry.connect(this.accounts.other).upgradeToAndCall(this.v2.tokenImpl.address, '0x'))
            .to.be.revertedWith(`AccessControlUnauthorizedAccount("${this.accounts.other.address}", "${this.roles.UPGRADER}")`);
        });
      });
    });
  });
});
