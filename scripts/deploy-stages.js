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

async function main(...stages) {
  const [ deployer ] = await ethers.getSigners();
  console.log(`Admin:    ${deployer.address}`);

  for (const id of stages) {
    console.log(`=== Deploying stage ${id}`);

    switch (id) {
      case 0:
        // Creator token registry/factory
        const registry = await deployUpgradeable('P00lsCreatorRegistry', 'transparent', [
          deployer.address,
          CONFIG.registry.name,
          CONFIG.registry.symbol,
        ]);
        console.log(`Registry: ${registry.address}`);

        // Creator token template
        const template = await deploy('P00lsCreatorToken', [
          registry.address,
        ]);
        console.log(`Template: ${template.address}`);

        // CONFIG
        await registry.upgradeTo(template.address);
        await registry.setBaseURI(CONFIG.registry.baseuri);
        break;

      default:
        throw new Error(`Stage ${id} not implemented`);
    }
  }
}

main(0)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
