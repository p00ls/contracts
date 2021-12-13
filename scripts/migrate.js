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
  DEBUG(`Admin:         ${accounts.admin.address}`);

  /*******************************************************************************************************************
   *                                                   Environment                                                   *
   *******************************************************************************************************************/
  // Weth
  const weth = await deploy('WETH');
  DEBUG(`WETH:          ${weth.address}`);

  /*******************************************************************************************************************
   *                                                     Vesting                                                     *
   *******************************************************************************************************************/
  const vesting = await deploy('VestedAirdrops', [
    accounts.admin.address,
  ]);
  DEBUG(`Vesting:       ${vesting.address}`);

  /*******************************************************************************************************************
   *                                              P00ls creator & token                                              *
   *******************************************************************************************************************/

  const escrow = await deploy('Escrow', [ accounts.admin.address ]);
  DEBUG(`Escrow:        ${escrow.address}`);

  // Creator token registry/factory
  const registry = await deployUpgradeable('P00lsCreatorRegistry', 'uups', [
    accounts.admin.address,
    CONFIG.registry.name,
    CONFIG.registry.symbol,
  ]);
  DEBUG(`Registry:      ${registry.address}`);

  // Creator token template
  const implementations = await Promise.all([
    deploy('P00lsTokenCreator',  [ registry.address ]),
    deploy('P00lsTokenXCreator', [ escrow.address   ]),
  ]);

  // setup
  await Promise.all([].concat(
    registry.upgradeCreatorToken(implementations[0].address),
    registry.upgradeXCreatorToken(implementations[1].address),
    registry.setBaseURI(CONFIG.registry.baseuri),
  ));

  // token generation
  const newCreatorToken = (admin, name, symbol, xname, xsymbol, root) => registry.createToken(admin, name, symbol, xname, xsymbol, root)
  .then(tx => tx.wait())
  .then(receipt => receipt.events.find(({ event }) => event === 'Transfer'))
  .then(event => event.args.tokenId)
  .then(tokenId => ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.zeroPad(tokenId, 20))))
  .then(address => attach('P00lsTokenCreator', address));

  const getXCreatorToken = (creatorToken) => creatorToken.xCreatorToken()
  .then(address => attach('P00lsTokenXCreator', address));

  // $00 as creator token
  const allocation = { index: 0, account: accounts.admin.address, amount: CONFIG.TARGETSUPPLY };
  const merkletree = merkle.createMerkleTree([ merkle.hashAllocation(allocation) ]);
  const token  = await newCreatorToken(
    accounts.admin.address,
    CONFIG.token.name,
    CONFIG.token.symbol,
    CONFIG.token.xname,
    CONFIG.token.xsymbol,
    merkletree.getRoot(),
  );
  const xToken = await getXCreatorToken(token);
  DEBUG(`Token:         ${token.address}`);
  DEBUG(`xToken:        ${xToken.address}`);
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
  DEBUG(`P00lsDAO:      ${dao.address}`);

  /*******************************************************************************************************************
   *                                                       AMM                                                       *
   *******************************************************************************************************************/
  // Factory
  const factory = await deploy('UniswapV2Factory', [ accounts.admin.address ]);
  DEBUG(`Factory:       ${factory.address}`);

  // Router
  const router = await deploy('UniswapV2Router02', [ factory.address, weth.address ]);
  DEBUG(`Router:        ${router.address}`);

  const auction = await deploy('AuctionManager', [ accounts.admin.address, router.address, timelock.address ]);
  DEBUG(`Auction:       ${auction.address}`);


  /*******************************************************************************************************************
   *                                                     Locking                                                     *
   *******************************************************************************************************************/
  const locking = await deploy('Locking', [ accounts.admin.address, router.address, token.address ]);
  DEBUG(`Locking:       ${locking.address}`);

  /*******************************************************************************************************************
   *                                                      Roles                                                      *
   *******************************************************************************************************************/
   const roles = await Promise.all(Object.entries({
    DEFAULT_ADMIN: ethers.constants.HashZero,
    PAIR_CREATOR:  factory.PAIR_CREATOR_ROLE(),
  }).map(entry => Promise.all(entry))).then(Object.fromEntries);

  await Promise.all([
    factory.connect(accounts.admin).grantRole(roles.PAIR_CREATOR,  auction.address       ),
    factory.connect(accounts.admin).setFeeTo(timelock.address), // do that until p00l launch and the staking program starts
  ].map(promise => promise.then(tx => tx.wait())));

  return {
    accounts,
    roles,
    vesting,
    registry,
    token,
    xToken,
    escrow,
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
      getXCreatorToken,
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
