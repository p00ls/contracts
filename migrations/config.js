const ethers = require("ethers");

module.exports = {
  admin: "0x7859821024E633C5dC8a4FcF86fC52e7720Ce525", // TODO: multisig
  contracts: {
    registry: {
      name:   "P00ls Creator",                         // TODO: check
      symbol: "P00lsCrea",                             // TODO: check
      // baseuri: "https://artists.p00ls.com/",        // TODO: this is not part of the migration, but should be discussed at some point
    },
    token: {
      name: "P00ls token",                             // TODO: check
      symbol: "$00",                                   // TODO: check
      xname: "P00ls X token",                          // TODO: check
      xsymbol: "x$00",                                 // TODO: check
    },
  },
  noCache: true,   // TODO: disable for live deployment
  noConfirm: true, // TODO: disable for live deployment
};
