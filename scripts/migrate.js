const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${deployer.address}`);

  const Registry = await ethers.getContractFactory('P00lSocialRegistry');
  const registry = await Registry.deploy(deployer.address, 'P00l Artist Registry', 'P00lAR')
  console.log(`Registry address: ${registry.address}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
