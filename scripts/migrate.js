const { ethers, upgrades } = require('hardhat');
const CONFIG = require('./config.json');
const DEBUG  = require('debug')('migration');

async function getFactory(name, opts = {}) {
  return ethers.getContractFactory(name).then(contract => contract.connect(opts.signer || contract.signer));
}

function attach(name, address, opts = {}) {
  return getFactory(name, opts).then(factory => factory.attach(address));
}

function deploy(name, args = [], opts = {}) {
  if (!Array.isArray(args)) { opts = args; args = []; }
  return getFactory(name, opts).then(factory => factory.deploy(...args)).then(contract => contract.deployed());
}

function deployUpgradeable(name, kind, args = [], opts = {}) {
  if (!Array.isArray(args)) { opts = args; args = []; }
  return getFactory(name, opts).then(factory => upgrades.deployProxy(factory, args, { kind })).then(contract => contract.deployed());
}

function performUpgrade(proxy, name, opts = {}) {
  return getFactory(name, opts).then(factory => upgrades.upgradeProxy(proxy.address, factory, {}));
}

async function migrate() {
  const accounts = await ethers.getSigners();
  accounts.admin = accounts.shift();
  DEBUG(`Admin:    ${accounts.admin.address}`);

  /*******************************************************************************************************************
   *                                              P00ls creator & token                                              *
   *******************************************************************************************************************/
  // Creator token registry/factory
  const registry = await deployUpgradeable('P00lsCreatorRegistry', 'transparent', [
    accounts.admin.address,
    CONFIG.registry.name,
    CONFIG.registry.symbol,
  ]);
  DEBUG(`Registry: ${registry.address}`);

  // Creator token template
  const template = await deploy('P00lsCreatorToken', [
    registry.address,
  ]);
  DEBUG(`Template: ${template.address}`);

  // setup
  await Promise.all([
    registry.upgradeTo(template.address),
    registry.setBaseURI(CONFIG.registry.baseuri),
  ]);

  // $00 as creator token
  const tokenId = await registry.createToken(accounts.admin.address, CONFIG.token.name, CONFIG.token.symbol, ethers.constants.HashZero) // todo: merkle
    .then(tx => tx.wait())
    .then(({ events }) => events.find(({ event }) => event === 'Transfer').args.tokenId);
  const token = await attach('P00lsCreatorToken', ethers.utils.hexlify(tokenId));
  DEBUG(`Token:    ${token.address}`);

  /*******************************************************************************************************************
   *                                                   Environment                                                   *
   *******************************************************************************************************************/
  // Weth
  const weth     = await deploy('WETH');
  DEBUG(`WETH:     ${weth.address}`);

  /*******************************************************************************************************************
   *                                                       AMM                                                       *
   *******************************************************************************************************************/
  // AMM Factory
  const factory  = await deploy('P00lsAMMFactory', [ accounts.admin.address ]);
  DEBUG(`Factory:  ${factory.address}`);

  // AMM Router
  const router   = await deploy('UniswapV2Router02', [ factory.address, weth.address ]);
  DEBUG(`Router:   ${router.address}`);

  return {
    accounts,
    registry,
    template,
    token,
    weth,
    amm: {
      factory,
      router,
    }
  };
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  CONFIG,
  migrate,
  attach,
  deploy,
  deployUpgradeable,
  performUpgrade,
};