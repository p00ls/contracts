const { ethers } = require('hardhat');
const { expect } = require('chai');

const { prepare, utils } = require('../fixture.js');

const Enum = (...options) => Object.fromEntries(options.map((key, i) => [key, ethers.BigNumber.from(i)]));
const BRIDGE_OP = Enum('DEPLOY', 'DEPOSIT');

function encodeDeployData(rootToken, name, symbol, xname, xsymbol) {
  const inner = ethers.utils.defaultAbiCoder.encode([ 'address', 'string', 'string', 'string', 'string' ], [ rootToken.address ?? rootToken, name, symbol, xname, xsymbol ]);
  const outer = ethers.utils.defaultAbiCoder.encode([ 'uint8', 'bytes' ], [ BRIDGE_OP.DEPLOY, inner ]);
  return outer;
}

function encodeDepositData(rootToken, to, amount) {
  const inner = ethers.utils.defaultAbiCoder.encode([ 'address', 'address', 'uint256' ], [ rootToken.address ?? rootToken, to.address ?? to, amount ]);
  const outer = ethers.utils.defaultAbiCoder.encode([ 'uint8', 'bytes' ], [ BRIDGE_OP.DEPOSIT, inner ]);
  return outer;
}

function encodeWithdrawData(rootToken, to, amount) {
  return ethers.utils.defaultAbiCoder.encode([ 'address', 'address', 'uint256' ], [ rootToken.address ?? rootToken, to.address ?? to, amount ]);
}

describe('Polygon Bridging: Child → Root', function () {
  prepare();

  before(async function () {
    this.accounts.receiver = this.accounts.shift();
    this.accounts.other    = this.accounts.shift();

    this.matic = {};
    this.matic.fxChild  = await utils.deploy('AA');
    this.matic.escrow   = await utils.deploy('Escrow', [ this.accounts.admin.address ]);
    this.matic.registry = await utils.deployUpgradeable(
      'P00lsCreatorRegistry_Polygon',
      'uups',
      [
        this.accounts.admin.address,
        this.config.contracts.registry.name,
        this.config.contracts.registry.symbol,
      ],
      {
        constructorArgs: [ this.matic.fxChild.address ],
      }
    );

    await utils.deploy('P00lsTokenCreator_Polygon', [ this.matic.registry.address ])
      .then(({ address }) => this.matic.registry.upgradeCreatorToken(address));

    await utils.deploy('P00lsTokenXCreatorV2', [ this.matic.escrow.address ])
      .then(({ address }) => this.matic.registry.upgradeXCreatorToken(address));

    this.fxRootTunnel = this.accounts.shift();
    await this.matic.registry.setFxRootTunnel(this.fxRootTunnel.address);

    this.matic.fxChild.forward = (target, signature, args = []) => this.matic.fxChild.__forward(target.address, 0, target.interface.encodeFunctionData(signature, args));

    // Overwrite the snapshot
    __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
  });

  it('post deployment check', async function () {
    expect(await this.matic.registry.fxRootTunnel()).to.be.equal(this.fxRootTunnel.address);
    expect(await this.matic.registry.fxChild()).to.be.equal(this.matic.fxChild.address);
  });

  it('cannot override fxChildTunnel', async function () {
    const randomAddress = ethers.utils.hexlify(ethers.utils.randomBytes(20));
    await expect(this.matic.registry.setFxRootTunnel(randomAddress))
      .to.be.revertedWith('FxBaseChildTunnel: ROOT_TUNNEL_ALREADY_SET');
  });

  describe('receive crosschain signal', async function () {
    it ('revert if not sent by the fxChild', async function () {
      await expect(this.matic.registry.processMessageFromRoot(0, this.fxRootTunnel.address, "0x"))
      .to.be.revertedWith('Invalid crosschain sender');
    });

    it ('revert if not sent by the fxChild', async function () {
      await expect(this.matic.fxChild.forward(this.matic.registry, 'processMessageFromRoot(uint256,address,bytes)', [ 0, this.accounts.admin.address, '0x' ]))
      .to.be.revertedWith('Invalid crosschain sender');
    });

    it ('revert if improper/empty data', async function () {
      await expect(this.matic.fxChild.forward(this.matic.registry, 'processMessageFromRoot(uint256,address,bytes)', [ 0, this.fxRootTunnel.address, '0x' ]))
      .to.be.reverted;
    });

    it ('deploy bridge token from signal', async function () {
      const [ name, symbol, xname, xsymbol ] = await Promise.all([ this.token.name(), this.token.symbol(), this.xToken.name(), this.xToken.symbol() ]);
      const data = encodeDeployData(this.token, name, symbol, xname, xsymbol);

      // Deploy from signal
      const tx = await this.matic.fxChild.forward(this.matic.registry, 'processMessageFromRoot(uint256,address,bytes)', [ 0, this.fxRootTunnel.address, data ]);

      this.matic.token = await tx.wait()
        .then(receipt => receipt.events.find(({ address }) => address === this.matic.registry.address))
        .then(event => this.matic.registry.interface.parseLog(event).args.tokenId)
        .then(tokenId => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.zeroPad(tokenId, 20))))
        .then(address => utils.attach('P00lsTokenCreator_Polygon', address));

      this.matic.xToken = await this.matic.token.xCreatorToken()
        .then(address => utils.attach('P00lsTokenXCreatorV2', address));

      expect(tx).to.emit(this.matic.registry, 'Transfer').withArgs(ethers.constants.ZeroAddress, this.accounts.admin.address, this.matic.token.address);

      // name, symbol and childToRoot are set correctly
      expect(await this.matic.registry.childToRoot(this.matic.token.address)).to.be.equal(this.token.address);
      expect(await this.matic.token.name()).to.be.equal(name);
      expect(await this.matic.token.symbol()).to.be.equal(symbol);
      expect(await this.matic.xToken.name()).to.be.equal(xname);
      expect(await this.matic.xToken.symbol()).to.be.equal(xsymbol);

      // Cannot deploy twice
      await expect(this.matic.fxChild.forward(this.matic.registry, 'processMessageFromRoot(uint256,address,bytes)', [ 0, this.fxRootTunnel.address, data ]))
      .to.be.reverted;
    });

    describe('With bridged token', function () {
      beforeEach(async function () {
        this.matic.token = await Promise.all([ this.token.name(), this.token.symbol(), this.xToken.name(), this.xToken.symbol() ])
          .then(names => encodeDeployData(this.token, ...names))
          .then(data => this.matic.fxChild.forward(this.matic.registry, 'processMessageFromRoot(uint256,address,bytes)', [ 0, this.fxRootTunnel.address, data ]))
          .then(tx => tx.wait())
          .then(receipt => receipt.events.find(({ address }) => address === this.matic.registry.address))
          .then(event => this.matic.registry.interface.parseLog(event).args.tokenId)
          .then(tokenId => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.zeroPad(tokenId, 20))))
          .then(address => utils.attach('P00lsTokenCreator_Polygon', address));
      });

      it('mint', async function () {
        const amount   = ethers.BigNumber.from(42);
        const data     = encodeDepositData(this.token, this.accounts.receiver, amount);
        const tx       = await this.matic.fxChild.forward(this.matic.registry, 'processMessageFromRoot(uint256,address,bytes)', [ 0, this.fxRootTunnel.address, data ]);
        expect(tx).to.emit(this.matic.token, 'Transfer').withArgs(ethers.constants.ZeroAddress, this.accounts.receiver, amount);
      });
    });
  });

  describe('emit back to root', function () {
    const amount = ethers.BigNumber.from(42);

    beforeEach(async function () {
      // deploy
      this.matic.token = await Promise.all([ this.token.name(), this.token.symbol(), this.xToken.name(), this.xToken.symbol() ])
      .then(names => encodeDeployData(this.token, ...names))
      .then(data => this.matic.fxChild.forward(this.matic.registry, 'processMessageFromRoot(uint256,address,bytes)', [ 0, this.fxRootTunnel.address, data ]))
      .then(tx => tx.wait())
      .then(receipt => receipt.events.find(({ address }) => address === this.matic.registry.address))
      .then(event => this.matic.registry.interface.parseLog(event).args.tokenId)
      .then(tokenId => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.zeroPad(tokenId, 20))))
      .then(address => utils.attach('P00lsTokenCreator_Polygon', address));

      // mint
      await this.matic.fxChild.forward(
        this.matic.registry,
        'processMessageFromRoot(uint256,address,bytes)',
        [
          0,
          this.fxRootTunnel.address,
          encodeDepositData(this.token, this.accounts.admin.address, ethers.utils.parseEther('1000000000')),
        ]
      );
    });

    describe('with open token', function () {
      beforeEach(async function () {
        expect(await this.matic.token.open())
        .to.emit(this.matic.token, 'Opened');
      });

      it('withdraw', async function () {
        await expect(this.matic.token.connect(this.accounts.admin).withdraw(this.accounts.receiver.address, amount))
        .to.emit(this.matic.token, 'Transfer').withArgs(this.accounts.admin.address, ethers.constants.ZeroAddress, amount)
        .to.emit(this.matic.registry, 'MessageSent').withArgs(encodeWithdrawData(
          this.token.address,
          this.accounts.receiver.address,
          amount,
        ));
      });

      it('withdrawFrom', async function () {
        // missing approval
        await expect(this.matic.token.connect(this.accounts.other).withdrawFrom(this.accounts.admin.address, this.accounts.receiver.address, amount))
        .to.be.revertedWith('ERC20: insufficient allowance');

        // with approval
        await this.matic.token.connect(this.accounts.admin).approve(this.accounts.other.address, ethers.constants.MaxUint256);

        await expect(this.matic.token.connect(this.accounts.other).withdrawFrom(this.accounts.admin.address, this.accounts.receiver.address, amount))
        .to.emit(this.matic.token, 'Transfer').withArgs(this.accounts.admin.address, ethers.constants.ZeroAddress, amount)
        .to.emit(this.matic.registry, 'MessageSent').withArgs(encodeWithdrawData(
          this.token.address,
          this.accounts.receiver.address,
          amount,
        ));
      });

      it('__withdraw', async function () {
        await expect(this.matic.registry.__withdraw(this.accounts.receiver.address, amount))
        .to.be.revertedWith('No known rootToken for withdrawal');
      });
    });
  });

  describe('whitelist', function () {
    beforeEach(async function () {
      // deploy
      this.matic.token = await Promise.all([ this.token.name(), this.token.symbol(), this.xToken.name(), this.xToken.symbol() ])
      .then(names => encodeDeployData(this.token, ...names))
      .then(data => this.matic.fxChild.forward(this.matic.registry, 'processMessageFromRoot(uint256,address,bytes)', [ 0, this.fxRootTunnel.address, data ]))
      .then(tx => tx.wait())
      .then(receipt => receipt.events.find(({ address }) => address === this.matic.registry.address))
      .then(event => this.matic.registry.interface.parseLog(event).args.tokenId)
      .then(tokenId => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.zeroPad(tokenId, 20))))
      .then(address => utils.attach('P00lsTokenCreator_Polygon', address));

      // mint
      await this.matic.fxChild.forward(
        this.matic.registry,
        'processMessageFromRoot(uint256,address,bytes)',
        [
          0,
          this.fxRootTunnel.address,
          encodeDepositData(this.token, this.accounts.admin.address, ethers.utils.parseEther('1000000000')),
        ]
      );

      // add admin to whitelist
      await this.matic.token.grantRole(this.roles.WHITELISTED, this.accounts.admin.address);
    });

    it('token is closed by default', async function () {
      expect(await this.matic.token.isOpen()).to.be.false;
    });

    describe('closed', function () {
      it ('open is restricted', async function () {
        await expect(this.matic.token.connect(this.accounts.other).open()).to.be.revertedWith('RegistryOwnable: caller is not the owner');
      });

      it ('whitelisted → non whitelisted: ok', async function () {
        await expect(this.matic.token.transferFrom(this.accounts.admin.address, this.accounts.receiver.address, 0))
        .to.emit(this.matic.token, 'Transfer').withArgs(this.accounts.admin.address, this.accounts.receiver.address, 0);
      });

      it ('non whitelisted → whitelisted: ok', async function () {
        await expect(this.matic.token.transferFrom(this.accounts.other.address, this.accounts.admin.address, 0))
        .to.emit(this.matic.token, 'Transfer').withArgs(this.accounts.other.address, this.accounts.admin.address, 0);
      });

      it ('non whitelisted → non whitelisted: revert', async function () {
        await expect(this.matic.token.transferFrom(this.accounts.other.address, this.accounts.receiver.address, 0))
        .to.be.revertedWith('Transfer restricted to whitelisted');
      });
    });

    describe('open', function () {
      beforeEach(async function () {
        expect(await this.matic.token.open()).to.emit(this.matic.token, 'Opened');
      });

      it('flag is set', async function () {
        expect(await this.matic.token.isOpen()).to.be.true;
      });

      it ('whitelisted → non whitelisted: ok', async function () {
        await expect(this.matic.token.transferFrom(this.accounts.admin.address, this.accounts.receiver.address, 0))
        .to.emit(this.matic.token, 'Transfer').withArgs(this.accounts.admin.address, this.accounts.receiver.address, 0);
      });

      it ('non whitelisted → whitelisted: ok', async function () {
        await expect(this.matic.token.transferFrom(this.accounts.other.address, this.accounts.admin.address, 0))
        .to.emit(this.matic.token, 'Transfer').withArgs(this.accounts.other.address, this.accounts.admin.address, 0);
      });

      it ('non whitelisted → non whitelisted: ok', async function () {
        await expect(this.matic.token.transferFrom(this.accounts.other.address, this.accounts.receiver.address, 0))
        .to.emit(this.matic.token, 'Transfer').withArgs(this.accounts.other.address, this.accounts.receiver.address, 0);
      });
    });
  });
});
