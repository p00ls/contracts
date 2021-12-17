const { ethers } = require('hardhat');
const migrate = require('../migrate.js');
const CONFIG = require('./config');

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
    const result = await migrate.migrate(CONFIG);
    await distributeEthers(result.accounts.admin);
    await result.amm.auction.start(result.token.address, 30);
    const auction = await result.amm.auction.getAuctionInstance(result.token.address).then(address => migrate.attach('Auction', address));
    await result.accounts.admin.sendTransaction({ to: auction.address, value: ethers.utils.parseEther('10') });
    await network.provider.send('evm_increaseTime', [ 40 ]);
    await result.amm.auction.finalize(result.token.address);
    const pair = await result.amm.factory.getPair(
        result.token.address,
        result.weth.address
    );
    console.log(result.amm.router)
    console.log(`WETH: ${result.weth.address}`)
    console.log(`Factory: ${result.amm.factory.address}`)
    console.log(`Router: ${result.amm.router.address}`)
    console.log(`Multicall: ${result.amm.multicall.address}`)
    console.log(`Pair: ${pair}`);
    console.log(`Token: ${result.token.address}`)
})();
