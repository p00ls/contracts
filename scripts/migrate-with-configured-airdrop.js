const { ethers } = require('hardhat');
const migrate = require('./migrate.js');
const CONFIG = require('./config');
const { createMerkleTree, hashVesting} = require("./utils/merkle.js");

const ethAccountsForAirdrop = [
    '0xECB2d6583858Aae994F4248f8948E35516cfc9cF',
    '0x386673855d10F86a705689412f432Fbc1cf32699',
    '0x73bdEDE5415620d47353a9d940A3CD9360B74b9A'
];

async function distributeEthers(account) {
    for (const ethAccount of ethAccountsForAirdrop) {
        await account.sendTransaction({
            to: ethAccount,
            value: ethers.utils.parseEther("1.0")
        });
    }
}

async function buildVesting(token) {
    const now = (await ethers.provider.getBlock()).timestamp;
    const result = [];
    let index = 0;
    for(const ethAccount of ethAccountsForAirdrop) {
        result.push({ index: index++, start: 0, cliff: 0, duration: 0, token: token.address, recipient: ethAccount, amount: ethers.utils.parseEther('1') })
        result.push({ index: index++, start: now, cliff: 100, duration: 300, token: token.address, recipient: ethAccount, amount: ethers.utils.parseEther('1') });
    }
    return result;
}

async function enableAirdrop(token, airdropContract, vestings) {
    await token.transfer(airdropContract.address, CONFIG.TARGETSUPPLY);
    const merkletree = createMerkleTree(vestings.map(hashVesting));
    const hexroot    = ethers.utils.hexlify(merkletree.getRoot());
    await airdropContract.enableAirdrop(hexroot, true);
}

(async () => {
    const result = await migrate.migrate();
    await distributeEthers(result.accounts.admin);
    const vestings = await buildVesting(result.token);
    await enableAirdrop(result.token, result.vesting, vestings);
})();
