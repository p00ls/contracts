const { ethers, upgrades } = require('hardhat');
const CONFIG = require('./config.json');

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

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Admin:    ${deployer.address}`);

  const token = await deployUpgradeable('P00ls', 'transparent', [
    CONFIG.token.name,
    CONFIG.token.symbol,
  ]);

  const registry = await deployUpgradeable('P00lsCreatorRegistry', 'transparent', [
    deployer.address,
    CONFIG.registry.name,
    CONFIG.registry.symbol,
  ]);
  await registry.setBaseURI(CONFIG.registry.baseuri);

  const weth     = await deploy('WETH');
  const factory  = await deploy('P00lsAMMFactory', [ deployer.address ]);
  const router   = await deploy('UniswapV2Router02', [ factory.address, weth.address ]);

  console.log(`Token:    ${token.address}`);
  console.log(`Registry: ${registry.address}`);
  console.log(`WETH:     ${weth.address}`);
  console.log(`Factory:  ${factory.address}`);
  console.log(`Router:   ${router.address}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
