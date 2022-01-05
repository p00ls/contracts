const { ethers } = require('hardhat');
const migrateAll = require('../migrateAll.js');
const CONFIG = require('./config');
const { attach } = require('@amxx/hre/scripts');

const faucetAccounts = ['0xECB2d6583858Aae994F4248f8948E35516cfc9cF'];

async function distributeEthers(account) {
    for (const ethAccount of faucetAccounts) {
        await account.sendTransaction({
            to: ethAccount,
            value: ethers.utils.parseEther("1.0")
        });
    }
}

(async () => {
    const result = await migrateAll(CONFIG);
    await distributeEthers(result.accounts[0]);
    const now = (await ethers.provider.getBlock()).timestamp
    await result.contracts.auction.start(result.contracts.token.address, now, 30);
    const auction = await result.contracts.auction.getAuctionInstance(result.contracts.token.address).then(address => attach('Auction', address));
    await result.accounts[0].sendTransaction({ to: auction.address, value: ethers.utils.parseEther('10') });
    await network.provider.send('evm_increaseTime', [ 40 ]);
    await result.contracts.auction.finalize(result.contracts.token.address);
    const pair = await result.contracts.factory.getPair(
        result.contracts.token.address,
        result.contracts.weth.address
    );
    console.log(`WETH: ${result.contracts.weth.address}`)
    console.log(`Factory: ${result.contracts.factory.address}`)
    console.log(`Router: ${result.contracts.router.address}`)
    console.log(`Multicall: ${result.contracts.multicall.address}`)
    console.log(`Pair: ${pair}`);
    console.log(`Token: ${result.contracts.token.address}`)
})();
