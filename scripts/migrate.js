const { ethers, upgrades } = require('hardhat');
const merkle = require('./utils/merkle');
const CONFIG = require('./config');
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
   *                                                   Environment                                                   *
   *******************************************************************************************************************/
  // Weth
  const weth = await deploy('WETH');
  DEBUG(`WETH:     ${weth.address}`);

  /*******************************************************************************************************************
   *                                                     Vesting                                                     *
   *******************************************************************************************************************/
  const vesting = await deploy('VestedAirdrops', [
    accounts.admin.address,
  ]);
  DEBUG(`Vesting:  ${vesting.address}`);

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

  // token generation
  const newCreatorToken = (admin, name, symbol, root) => registry.createToken(admin, name, symbol, root)
  .then(tx => tx.wait())
  .then(receipt => receipt.events.find(({ event }) => event === 'Transfer'))
  .then(event => event.args.tokenId)
  .then(tokenId => ethers.utils.getAddress(ethers.utils.hexlify(tokenId)))
  .then(address => attach('P00lsCreatorToken', address));

  // $00 as creator token
  const allocation = { index: 0, account: accounts.admin.address, amount: CONFIG.TARGETSUPPLY };
  const merkletree = merkle.createMerkleTree([ merkle.hashAllocation(allocation) ]);
  const token = await newCreatorToken(accounts.admin.address, CONFIG.token.name, CONFIG.token.symbol, merkletree.getRoot());
  DEBUG(`Token:    ${token.address}`);
  await token.claim(allocation.index, allocation.account, allocation.amount, merkletree.getHexProof(merkle.hashAllocation(allocation)))

  /*******************************************************************************************************************
   *                                                       DAO                                                       *
   *******************************************************************************************************************/
  const timelock = await deployUpgradeable('P00lsTimelock', 'transparent', [
    86400 * 7, // 7 days
    [],
    [],
  ]);
  DEBUG(`P00lsTimelock: ${timelock.address}`);

  const dao = await deployUpgradeable('P00lsDAO', 'transparent', [
    token.address,
    timelock.address,
  ]);
  DEBUG(`P00lsDAO: ${dao.address}`);

  /*******************************************************************************************************************
   *                                                       AMM                                                       *
   *******************************************************************************************************************/
  // Factory
  const factory = await deploy('UniswapV2Factory', [ accounts.admin.address ]);
  DEBUG(`Factory:  ${factory.address}`);

  // Router
  const router = await deploy('UniswapV2Router02', [ factory.address, weth.address ]);
  DEBUG(`Router:   ${router.address}`);

  // DutchAuctionManager
  const auction = await deploy('AuctionManager', [ accounts.admin.address, router.address, timelock.address ]);
  DEBUG(`Auction:  ${auction.address}`);


  /*******************************************************************************************************************
   *                                                    Stacking                                                     *
   *******************************************************************************************************************/
  // DutchAuctionManager
  const staking = await deploy('P00lsStaking', [ accounts.admin.address, router.address, token.address ]);
  DEBUG(`Staking: ${staking.address}`);

  /*******************************************************************************************************************
   *                                                      Roles                                                      *
   *******************************************************************************************************************/
   const roles = await Promise.all(Object.entries({
    DEFAULT_ADMIN:   ethers.constants.HashZero,
    PAIR_CREATOR:    factory.PAIR_CREATOR_ROLE(),
    AUCTION_MANAGER: auction.AUCTION_MANAGER_ROLE(),
    LOCK_MANAGER:    staking.LOCK_MANAGER_ROLE(),
  }).map(entry => Promise.all(entry))).then(Object.fromEntries);

  await Promise.all([
    factory.connect(accounts.admin).grantRole(roles.PAIR_CREATOR,    auction.address),
    auction.connect(accounts.admin).grantRole(roles.AUCTION_MANAGER, accounts.admin.address),
    staking.connect(accounts.admin).grantRole(roles.LOCK_MANAGER,    accounts.admin.address),
  ]);

  return {
    accounts,
    roles,
    vesting,
    registry,
    template,
    token,
    weth,
    staking,
    governance: {
      dao,
      timelock,
    },
    amm: {
      factory,
      router,
      auction,
    },
    workflows: {
      newCreatorToken,
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
  utils: {
    merkle,
  },
};