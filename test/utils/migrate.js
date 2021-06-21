const { ethers, upgrades } = require('hardhat');
const CONFIG = require('../../scripts/config.json');

async function attach(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.attach(...params);
}

async function deploy(name, params = []) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then(f => f.deployed());
}

async function deployUpgradeable(name, kind, params = []) {
  const Contract = await ethers.getContractFactory(name);
  return await upgrades.deployProxy(Contract, params, { kind }).then(f => f.deployed());
}

async function performUpgrade(proxy, name) {
  const Contract = await ethers.getContractFactory(name);
  return await upgrades.upgradeProxy(proxy.address, Contract, {});
}

function migrate() {
  before(async function() {
    this.accounts       = await ethers.getSigners();
    this.accounts.admin = this.accounts.shift();
  });

  beforeEach(async function () {
    // Pools
    this.token = await deployUpgradeable('P00ls', 'transparent', [
      CONFIG.token.name,
      CONFIG.token.symbol,
    ]);
    // Registry
    this.registry = await deployUpgradeable('P00lsCreatorRegistry', 'transparent', [
      this.accounts.admin.address,
      CONFIG.registry.name,
      CONFIG.registry.symbol,
    ]);
    await this.registry.connect(this.accounts.admin).setBaseURI(CONFIG.registry.baseuri);
    // AMM
    this.amm         = {};
    this.amm.weth    = await deploy('WETH');
    this.amm.factory = await deploy('P00lsAMMFactory', [ this.accounts.admin.address ]);
    this.amm.router  = await deploy('UniswapV2Router02', [ this.amm.factory.address, this.amm.weth.address ]);
  });
}

module.exports = Object.assign(migrate, {
  attach,
  deploy,
  deployUpgradeable,
  performUpgrade,
  CONFIG,
});
