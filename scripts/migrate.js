const { ethers, upgrades } = require('hardhat');
const CONFIG = require('./config.json');

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

async function main() {
  const [ deployer ] = await ethers.getSigners();
  console.log(`Admin:    ${deployer.address}`);

  // Token
  const token = await deployUpgradeable('P00ls', 'transparent', [
    CONFIG.token.name,
    CONFIG.token.symbol,
  ]);
  console.log(`Token:    ${token.address}`);

  // Creator token registry/factory
  const registry = await deployUpgradeable('P00lsCreatorRegistry', 'transparent', [
    deployer.address,
    CONFIG.registry.name,
    CONFIG.registry.symbol,
  ]);
  console.log(`Registry: ${registry.address}`);

  // Weth
  const weth     = await deploy('WETH');
  console.log(`WETH:     ${weth.address}`);

  // AMM Factory
  const factory  = await deploy('P00lsAMMFactory', [ deployer.address ]);
  console.log(`Factory:  ${factory.address}`);

  // AMM Router
  const router   = await deploy('UniswapV2Router02', [ factory.address, weth.address ]);
  console.log(`Router:   ${router.address}`);

  // CONFIG
  await registry.setBaseURI(CONFIG.registry.baseuri);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
