require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-gas-reporter');
require('dotenv').config();

const settings = {
  optimizer: {
    enabled: true,
    runs: 999,
  },
};

module.exports = {
  solidity: {
    compilers: [
      { version: '0.8.4',  settings },
      { version: '0.7.6',  settings },
      { version: '0.6.12', settings },
      { version: '0.5.16', settings },
    ],
  },
  networks: {},
  gasReporter: {
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP,
    gasPrice: 120,
  },
};

// const argv = require('yargs/yargs')()
//   .env('')
//   .boolean('fork')
//   .string('compileMode')
//   .argv;

// if (argv.fork) {
//   module.exports.networks['mainnet-fork'] = {
//     forking: {
//       url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API}`,
//     },
//   };
// }

// if (argv.jsonrpc) {
//   module.exports.networks['mainnet'] = {
//     url: process.env.JSONRPC,
//     accounts: [],
//   };
// }
