const { ethers } = require('hardhat');
const { expect } = require('chai');

const { prepare, utils } = require('../fixture.js');

const IFxStateSender = new ethers.utils.Interface([ 'function sendMessageToChild(address,bytes)' ]);

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

describe('Polygon Bridging: Root → Child', function () {
  prepare();

  before(async function () {
    this.checkpointManager = await utils.deploy('AA');
    this.fxRoot            = await utils.deploy('AA');
    this.fxChildTunnel     = this.accounts.unshift();

    // deploy bridge & record crosschain link
    this.bridge = await utils.deploy(
        'P00lsBridgePolygon',
        [
            this.checkpointManager.address,
            this.fxRoot.address,
            this.registry.address
        ],
    );
    await this.bridge.setFxChildTunnel(this.fxChildTunnel.address);

    // Overwrite the snapshot
    __SNAPSHOT_ID__ = await ethers.provider.send('evm_snapshot');
  });

  it('post deployment check', async function () {
    expect(await this.bridge.checkpointManager()).to.be.equal(this.checkpointManager.address);
    expect(await this.bridge.fxRoot()).to.be.equal(this.fxRoot.address);
    expect(await this.bridge.fxChildTunnel()).to.be.equal(this.fxChildTunnel.address);
    expect(await this.bridge.registry()).to.be.equal(this.registry.address);
  });

  it('cannot override fxChildTunnel', async function () {
    const randomAddress = ethers.utils.hexlify(ethers.utils.randomBytes(20));
    await expect(this.bridge.setFxChildTunnel(randomAddress))
      .to.be.revertedWith('FxBaseRootTunnel: CHILD_TUNNEL_ALREADY_SET');
  });

  describe('emit', function () {
    it('deploy', async function () {
      const data = await Promise.all([
        this.token.name(),
        this.token.symbol(),
        this.xToken.name(),
        this.xToken.symbol(),
      ]).then(params => IFxStateSender.encodeFunctionData(
        'sendMessageToChild(address,bytes)',
        [
          this.fxChildTunnel.address,
          encodeDeployData(this.token, ...params),
        ],
      ));

      await expect(this.bridge.deploy(this.token.address))
      .to.emit(this.fxRoot, 'Call').withArgs(this.bridge.address, 0, data);
    });

    it('invalid token', async function () {
      const randomAddress = ethers.utils.hexlify(ethers.utils.randomBytes(20));
      await expect(this.bridge.bridge(randomAddress, this.accounts.admin.address, 0))
      .to.be.revertedWith('ERC721: invalid token ID');
    });

    it('bridge approved token', async function () {
      await this.token.connect(this.accounts.admin).approve(this.bridge.address, ethers.constants.MaxUint256);

      const receiver = ethers.utils.hexlify(ethers.utils.randomBytes(20));
      const amount   = ethers.BigNumber.from(17);
      const data     = IFxStateSender.encodeFunctionData(
        'sendMessageToChild(address,bytes)',
        [
          this.fxChildTunnel.address,
          encodeDepositData(this.token, receiver, amount),
        ],
      );

      await expect(this.bridge.connect(this.accounts.admin).bridge(this.token.address, receiver, amount))
      .to.emit(this.token, 'Transfer').withArgs(this.accounts.admin.address, this.bridge.address, amount)
      .to.emit(this.fxRoot, 'Call').withArgs(this.bridge.address, 0, data);
    });

    it('bridge using ERC1363.transferAndCall', async function () {
      const receiver = ethers.utils.hexlify(ethers.utils.randomBytes(20));
      const encoded  = ethers.utils.defaultAbiCoder.encode([ 'address' ], [ receiver ]);
      const amount   = ethers.BigNumber.from(42);
      const data     = IFxStateSender.encodeFunctionData(
        'sendMessageToChild(address,bytes)',
        [
          this.fxChildTunnel.address,
          encodeDepositData(this.token, receiver, amount),
        ],
      );

      // missing data
      await expect(this.token.connect(this.accounts.admin)['transferAndCall(address,uint256)'](this.bridge.address, amount))
      .to.be.revertedWith('ERC1363: onTransferReceived reverted without reason');

      // with data
      await expect(this.token.connect(this.accounts.admin)['transferAndCall(address,uint256,bytes)'](this.bridge.address, amount, encoded))
      .to.emit(this.token, 'Transfer').withArgs(this.accounts.admin.address, this.bridge.address, amount)
      .to.emit(this.fxRoot, 'Call').withArgs(this.bridge.address, 0, data);
    });
  });
});
