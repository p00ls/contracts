const { ethers } = require('hardhat');
const migrateAll = require('../migrateAll.js');
const CONFIG = require('./config');
const { createMerkleTree, hashVesting} = require("../utils/merkle");

const ethAccountsForAirdrop = ['0xECB2d6583858Aae994F4248f8948E35516cfc9cF','0x386673855d10F86a705689412f432Fbc1cf32699'];

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
        result.push({ index: index++, start: now, cliff: 100, duration: 300, token: token.address, recipient: ethAccount, amount: ethers.utils.parseEther('10') });
    }
    return result;
}

async function enableAirdrop(token, airdropContract, merkletree) {
    await token.transfer(airdropContract.address, ethers.utils.parseEther('500000'));
    const hexroot    = ethers.utils.hexlify(merkletree.getRoot());
    await airdropContract.enableAirdrop(hexroot, true);
}

function showProofs(airdropContract, vestings, merkletree) {
    for (const vesting of vestings) {
        const hash = hashVesting(vesting);
        const proof = merkletree.getHexProof(hash);
        console.log({...vesting, amount: vesting.amount.toString()});
        console.log(`Hash: ${ethers.utils.hexlify(hash)}`);
        console.log(`Proof: ${proof}`);
        //console.log(`data: ${airdropContract.interface.encodeFunctionData("release", [vesting, proof])}`);
    }
}

function showContracts(migrationResult) {
    console.log(`Airdrop contract: ${migrationResult.contracts.vesting.address}`);
    console.log(`Token contract: ${migrationResult.contracts.token.address}`);
}

(async () => {
    const result = await migrateAll(CONFIG);
    await distributeEthers(result.accounts[0]);
    const vestings = await buildVesting(result.contracts.token);
    const merkletree = createMerkleTree(vestings.map(hashVesting));
    await enableAirdrop(result.contracts.token, result.contracts.vesting, merkletree);
    showProofs(result.contracts.vesting, vestings, merkletree);
    showContracts(result);
})();
