const ethers = require("ethers");

module.exports = {
  admin: "0x491Ba84a68570f08E0f0fe0078D5B3DdB61853e5",
  contracts: {
    registry: {
      name:   "P00LS Creator Registry",
      symbol: "P00LSCreatorRegistry",
      // baseuri: "https://artists.p00ls.com/",        // TODO: this is not part of the migration, but should be discussed at some point
    },
    token: {
      name: "00 Token",
      symbol: "00",
      xname: "x00 Token",
      xsymbol: "x00",
    },
  },
  noCache: true,   // TODO: disable for live deployment
  noConfirm: true, // TODO: disable for live deployment
};
