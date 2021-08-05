require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-gas-reporter');

const argv = require('yargs/yargs')()
  .env('')
  .string('mnemonic')
  .boolean('fork')
  .boolean('slow')
  .argv;

const settings = {
  optimizer: {
    enabled: true,
    runs: 999,
  },
};

module.exports = {
  solidity: {
    compilers: [
      { version: '0.8.6',  settings },
      { version: '0.7.6',  settings },
      { version: '0.6.12', settings },
      { version: '0.5.16', settings },
    ],
  },
  networks: {},
  etherscan: {
    apiKey: process.env.ETHERSCAN,
  },
	gasReporter: {
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP,
    gasPrice: 20,
  },
};

Object.assign(
  module.exports.networks,
  argv.mnemonic && Object.fromEntries([
    'mainnet',
    'ropsten',
    'rinkeby',
    'goerli',
    'kovan',
  ].map(name => [ name, { url: argv[`${name}Node`], accounts: [ argv.mnemonic ]} ]).filter(([, { url} ]) => url)),
  argv.slow && { hardhat: { mining: { auto: false, interval: [3000, 6000] }}}, // Simulate a slow chain locally
  argv.fork && { hardhat: { forking: { url: argv.mainnetNode }}}, // Simulate a mainnet fork
);
