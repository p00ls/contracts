const ethers = require("ethers");

module.exports = {
  contracts: {
    token: {
      name: "P00ls token",
      symbol: "$00",
      xname: "P00ls X token",
      xsymbol: "x$00",
      merkleroot: ethers.constants.HashZero,
    },
    governance: {
      timelockMinDelay: 86400 * 7,
    },
    vesting: {},
    escrow: {},
    registry: {
      name:   "P00ls Creator Token",
      symbol: "P00lsCrea",
      baseuri: "https://artists.p00ls.com/",
    },
    amm: {},
    auction: {},
    locking: {},
  },
  extra: {
    DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_DEPLOYER:        ethers.utils.parseEther('500000'),
    DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_AUCTION_MANAGER: ethers.utils.parseEther('500000'),
  },
  noCache: false,
  noConfirm: false,
};
