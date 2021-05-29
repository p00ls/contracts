const { ethers } = require("hardhat");

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then(f => f.deployed());
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Admin:    ${deployer.address}`);

  const registry = await deploy('P00lsSocialRegistry', deployer.address, 'P00l Artist Registry', 'P00lAR');
  const weth     = await deploy('WETH');
  const factory  = await deploy('P00lsAMMFactory', deployer.address);
  const router   = await deploy('P00lsAMMFactoryRouter', factory.address, weth.address);
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
