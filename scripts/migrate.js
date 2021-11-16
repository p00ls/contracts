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
  const timelock = await deploy('TimelockController', [
    86400 * 7, // 7 days
    [],
    [],
  ]);
  DEBUG(`P00lsTimelock: ${timelock.address}`);

  const dao = await deployUpgradeable('P00lsDAO', 'uups', [
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
  const locking = await deploy('Locking', [ accounts.admin.address, router.address, token.address ]);
  DEBUG(`Locking: ${locking.address}`);

  /*******************************************************************************************************************
   *                                                      Roles                                                      *
   *******************************************************************************************************************/
   const roles = await Promise.all(Object.entries({
    DEFAULT_ADMIN:          ethers.constants.HashZero,
    AUCTION_MANAGER:        auction.AUCTION_MANAGER_ROLE(),
    LOCK_MANAGER:           locking.LOCK_MANAGER_ROLE(),
    PAIR_CREATOR:           factory.PAIR_CREATOR_ROLE(),
    VESTED_ARIDROP_MANAGER: vesting.VESTED_ARIDROP_MANAGER_ROLE(),
  }).map(entry => Promise.all(entry))).then(Object.fromEntries);

  await Promise.all([
    auction.connect(accounts.admin).grantRole(roles.AUCTION_MANAGER,        accounts.admin.address),
    locking.connect(accounts.admin).grantRole(roles.LOCK_MANAGER,           accounts.admin.address),
    factory.connect(accounts.admin).grantRole(roles.PAIR_CREATOR,           auction.address       ),
    vesting.connect(accounts.admin).grantRole(roles.VESTED_ARIDROP_MANAGER, accounts.admin.address),
    factory.connect(accounts.admin).setFeeTo(timelock.address), // do that until p00l launch and the staking program starts
  ].map(tx => tx.wait()));

  return {
    accounts,
    roles,
    vesting,
    registry,
    template,
    token,
    weth,
    locking,
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
