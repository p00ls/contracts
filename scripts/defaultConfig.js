const ethers = require("ethers");

module.exports = {
  timelock: {
    mindelay: 86400 * 7,
  },
  token: {
    name: "P00ls token",
    symbol: "$00",
    xname: "P00ls X token",
    xsymbol: "x$00"
  },
  registry: {
    name:   "P00ls Creator Token",
    symbol: "P00lsCrea",
    baseuri: "https://artists.p00ls.com/"
  },
  TARGETSUPPLY: ethers.utils.parseEther('1000000'),
  DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_AUCTION_MANAGER: ethers.utils.parseEther('1000000').div(2),
  noCache: true,
  noConfirm: true,
};
