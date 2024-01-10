const ethers = require("ethers");

module.exports = {
  contracts: {
    token: {
      name: "00 Token",
      symbol: "00",
      xname: "x00 Token",
      xsymbol: "x00",
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
    giftcards: {
      Test: {
        name: 'Test', // optional, default to the entry name
        symbol: 'test', // required
        owner: '0x7859821024E633C5dC8a4FcF86fC52e7720Ce525', // optional, default to signer
        beneficiary: '0x7859821024E633C5dC8a4FcF86fC52e7720Ce525', // optional, default to admin/signer,
        uri: 'http://something.com/tokenId/', // optional, default is empty
        mintFee: ethers.utils.parseEther('1'), // optional, default to 0
        account: '0x41C8f39463A868d3A88af00cd0fe7102F30E44eC'
      },
    },
  },
  extra: {
    DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_DEPLOYER:        ethers.utils.parseEther('500000'),
    DEFAULT_TOKEN_AMOUNT_ALLOCATED_TO_AUCTION_MANAGER: ethers.utils.parseEther('500000'),
  },
  noCache: false,
  noConfirm: false,
};
