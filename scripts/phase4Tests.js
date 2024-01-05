const { MigrationManager } = require('@amxx/hre/scripts');
const DEBUG  = require('debug')('p00ls');
const matic  = require('@maticnetwork/fx-portal/config/config');
const {ethers, waffle} = require("hardhat");
const merkle = require('./utils/merkle');
const {generateTypedData} = require("@safe-global/protocol-kit/dist/src/utils");
const {attach} = require("@amxx/hre/scripts/deploy");

require('dotenv').config();
const argv = require('yargs/yargs')(process.argv.slice(2)).env('').argv;

const gnosisSafeAbi = [{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"owner","type":"address"}],"name":"AddedOwner","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"approvedHash","type":"bytes32"},{"indexed":true,"internalType":"address","name":"owner","type":"address"}],"name":"ApproveHash","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"handler","type":"address"}],"name":"ChangedFallbackHandler","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"guard","type":"address"}],"name":"ChangedGuard","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"threshold","type":"uint256"}],"name":"ChangedThreshold","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"module","type":"address"}],"name":"DisabledModule","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"module","type":"address"}],"name":"EnabledModule","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"txHash","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"payment","type":"uint256"}],"name":"ExecutionFailure","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"module","type":"address"}],"name":"ExecutionFromModuleFailure","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"module","type":"address"}],"name":"ExecutionFromModuleSuccess","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"txHash","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"payment","type":"uint256"}],"name":"ExecutionSuccess","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"owner","type":"address"}],"name":"RemovedOwner","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"module","type":"address"},{"indexed":false,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"enum Enum.Operation","name":"operation","type":"uint8"}],"name":"SafeModuleTransaction","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"enum Enum.Operation","name":"operation","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"safeTxGas","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"baseGas","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"gasPrice","type":"uint256"},{"indexed":false,"internalType":"address","name":"gasToken","type":"address"},{"indexed":false,"internalType":"address payable","name":"refundReceiver","type":"address"},{"indexed":false,"internalType":"bytes","name":"signatures","type":"bytes"},{"indexed":false,"internalType":"bytes","name":"additionalInfo","type":"bytes"}],"name":"SafeMultiSigTransaction","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"SafeReceived","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"initiator","type":"address"},{"indexed":false,"internalType":"address[]","name":"owners","type":"address[]"},{"indexed":false,"internalType":"uint256","name":"threshold","type":"uint256"},{"indexed":false,"internalType":"address","name":"initializer","type":"address"},{"indexed":false,"internalType":"address","name":"fallbackHandler","type":"address"}],"name":"SafeSetup","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"msgHash","type":"bytes32"}],"name":"SignMsg","type":"event"},{"stateMutability":"nonpayable","type":"fallback"},{"inputs":[],"name":"VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"_threshold","type":"uint256"}],"name":"addOwnerWithThreshold","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"hashToApprove","type":"bytes32"}],"name":"approveHash","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"approvedHashes","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_threshold","type":"uint256"}],"name":"changeThreshold","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"dataHash","type":"bytes32"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes","name":"signatures","type":"bytes"},{"internalType":"uint256","name":"requiredSignatures","type":"uint256"}],"name":"checkNSignatures","outputs":[],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"dataHash","type":"bytes32"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes","name":"signatures","type":"bytes"}],"name":"checkSignatures","outputs":[],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"prevModule","type":"address"},{"internalType":"address","name":"module","type":"address"}],"name":"disableModule","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"domainSeparator","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"module","type":"address"}],"name":"enableModule","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"enum Enum.Operation","name":"operation","type":"uint8"},{"internalType":"uint256","name":"safeTxGas","type":"uint256"},{"internalType":"uint256","name":"baseGas","type":"uint256"},{"internalType":"uint256","name":"gasPrice","type":"uint256"},{"internalType":"address","name":"gasToken","type":"address"},{"internalType":"address","name":"refundReceiver","type":"address"},{"internalType":"uint256","name":"_nonce","type":"uint256"}],"name":"encodeTransactionData","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"enum Enum.Operation","name":"operation","type":"uint8"},{"internalType":"uint256","name":"safeTxGas","type":"uint256"},{"internalType":"uint256","name":"baseGas","type":"uint256"},{"internalType":"uint256","name":"gasPrice","type":"uint256"},{"internalType":"address","name":"gasToken","type":"address"},{"internalType":"address payable","name":"refundReceiver","type":"address"},{"internalType":"bytes","name":"signatures","type":"bytes"}],"name":"execTransaction","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"enum Enum.Operation","name":"operation","type":"uint8"}],"name":"execTransactionFromModule","outputs":[{"internalType":"bool","name":"success","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"enum Enum.Operation","name":"operation","type":"uint8"}],"name":"execTransactionFromModuleReturnData","outputs":[{"internalType":"bool","name":"success","type":"bool"},{"internalType":"bytes","name":"returnData","type":"bytes"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getChainId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"start","type":"address"},{"internalType":"uint256","name":"pageSize","type":"uint256"}],"name":"getModulesPaginated","outputs":[{"internalType":"address[]","name":"array","type":"address[]"},{"internalType":"address","name":"next","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getOwners","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"offset","type":"uint256"},{"internalType":"uint256","name":"length","type":"uint256"}],"name":"getStorageAt","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getThreshold","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"enum Enum.Operation","name":"operation","type":"uint8"},{"internalType":"uint256","name":"safeTxGas","type":"uint256"},{"internalType":"uint256","name":"baseGas","type":"uint256"},{"internalType":"uint256","name":"gasPrice","type":"uint256"},{"internalType":"address","name":"gasToken","type":"address"},{"internalType":"address","name":"refundReceiver","type":"address"},{"internalType":"uint256","name":"_nonce","type":"uint256"}],"name":"getTransactionHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"module","type":"address"}],"name":"isModuleEnabled","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"isOwner","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"nonce","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"prevOwner","type":"address"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"_threshold","type":"uint256"}],"name":"removeOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"enum Enum.Operation","name":"operation","type":"uint8"}],"name":"requiredTxGas","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"handler","type":"address"}],"name":"setFallbackHandler","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"guard","type":"address"}],"name":"setGuard","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"_owners","type":"address[]"},{"internalType":"uint256","name":"_threshold","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"address","name":"fallbackHandler","type":"address"},{"internalType":"address","name":"paymentToken","type":"address"},{"internalType":"uint256","name":"payment","type":"uint256"},{"internalType":"address payable","name":"paymentReceiver","type":"address"}],"name":"setup","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"signedMessages","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"targetContract","type":"address"},{"internalType":"bytes","name":"calldataPayload","type":"bytes"}],"name":"simulateAndRevert","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"prevOwner","type":"address"},{"internalType":"address","name":"oldOwner","type":"address"},{"internalType":"address","name":"newOwner","type":"address"}],"name":"swapOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}];

async function migrate(config = {}, env = {})
{
    const signer  = env.signer   || await ethers.getSigner();
    const network = await ethers.provider.getNetwork();
    const chains  = {};
    const opts    = {};
    const l1Ethers = ethers.Wallet.fromMnemonic(argv.mnemonic);

    switch (network.chainId) {
        // mumbai
        case 80001:
            chains.L1 = l1Ethers.connect(ethers.getDefaultProvider(argv.goerliNode));
            chains.L2 = signer;
            config.matic = matic.testnet;
            break;
        default:
            throw new Error(`Unsuported network: ${network.name} (${network.chainId})`);
    }

    const { L1, L2 } = chains;
    L1.manager = new MigrationManager(L1.provider);
    L2.manager = new MigrationManager(L2.provider);
    const mainRegistry = await L1.manager.cacheAsPromise.then(cache => cache.get('registry'));
    const mainBridge = await L1.manager.cacheAsPromise.then(cache => cache.get('matic-bridge'));
    const sidechainRegistry = await L2.manager.cacheAsPromise.then(cache => cache.get('matic-registry'));
    DEBUG(`=== config ===`);
    DEBUG(`L1: ${L1.provider.network.name} (${L1.provider.network.chainId}) - ${L1.address}`);
    DEBUG(`L2: ${L2.provider.network.name} (${L2.provider.network.chainId}) - ${L2.address}`);
    DEBUG(`=== start ===`);
    const tokenName = 'My token 9';
    const tokenSymbol = 'MYT9';
    const tokenXName = `X${tokenSymbol}`;
    const tokenXSymbol = `X${tokenSymbol}`;
    const zzfDaoTreasury = '0xB87502D019705c72c55A90126c20cDe5AA264406'; //msig goerli staging
    const l2MultisigWithRegistryManagerRole = '0x3dEeF0f84e24B469207aa1c2bD3c48DF3Fa6981E';
    const l1MultisigWithRegistryManagerRole = '0xB87502D019705c72c55A90126c20cDe5AA264406';
    const l2TokenVault = '0x3dEeF0f84e24B469207aa1c2bD3c48DF3Fa6981E';
    const newTokenOwner = "0xECB2d6583858Aae994F4248f8948E35516cfc9cF";
    //L1 Calculate merkle tree for mainnet distribution
    //L1 90% goes to bridge
    //L1 10% goes to zzf dao treasury
    const allocations = [
        { index: 0, account: mainBridge, amount: ethers.utils.parseEther("9000000000") },
        { index: 1, account: zzfDaoTreasury, amount: ethers.utils.parseEther("1000000000") },
    ];
    const merkletree = merkle.createMerkleTree(allocations.map(merkle.hashAllocation));
    allocations.map(allocation => {
        DEBUG(`PROOF: ${merkletree.getHexProof(merkle.hashAllocation(allocation))}`);
    });
    //L1 Predict goerli contract address
    const l1Registry = await attach("P00lsCreatorRegistry_V2", mainRegistry, {signer: L1});
    const predictedMainnetContract = await l1Registry.predictToken2(tokenName,tokenSymbol,`X${tokenSymbol}`,`X${tokenSymbol}`,merkletree.getHexRoot());
    DEBUG(`L1 Predicted main chain contract ${predictedMainnetContract}`);
    //L2 Mint mumbai token
    //L2 We provide a signature to call the execute function on the mumbai multisig 1 of n that has registry manager role
    //L2 Current signer is member of this multisig so we can sign directly
    //L2 We calculate the call of forceBridgeToken method on the registry
    const l2Registry = await attach("P00lsCreatorRegistry_Polygon_V2", sidechainRegistry, {signer: L2});
    const l2MintingData = l2Registry.interface.encodeFunctionData("forceBridgeToken", [
        newTokenOwner,
        predictedMainnetContract,
        tokenName,
        tokenSymbol,
        tokenXName,
        tokenXSymbol,
        l2TokenVault,
        allocations[0].amount]);
    DEBUG(`L2 Minting data payload ${l2MintingData}`);
    //L2 We calculate the required signature to mint
    const l2Multisig = new ethers.Contract(l2MultisigWithRegistryManagerRole, gnosisSafeAbi, L2);
    const l2MultisigCurrentNonce = await l2Multisig.nonce();
    const l2MultisigVersion = await l2Multisig.VERSION();
    const l2TypedData = generateTypedData({
        chainId: 80001,
        safeAddress: l2MultisigWithRegistryManagerRole,
        safeVersion: l2MultisigVersion,
        safeTransactionData: {
            to: l2Registry.address,
            value: '0',
            data: l2MintingData,
            baseGas: '0',
            gasPrice: '0',
            safeTxGas: '0',
            operation: '0',
            gasToken: '0x0000000000000000000000000000000000000000',
            refundReceiver: '0x0000000000000000000000000000000000000000',
            nonce: l2MultisigCurrentNonce
        }
    });
    const l2Signature = await L2._signTypedData(
        l2TypedData.domain,
        { SafeTx: l2TypedData.types.SafeTx },
        l2TypedData.message
    );
    DEBUG(`L2 Generated signature ${l2Signature}`)
    //L2 We mint token on mumbai by calling multisig contract, anyone can make this transaction
    const l2Minting = await l2Multisig.execTransaction(
        l2Registry.address,
        0,
        l2MintingData,
        0,
        0,
        0,
        0,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        l2Signature,
        {gasLimit: 2000000}
    );
    DEBUG(`L2 Token minting in progress ${l2Minting.hash}`);
    const l2MintingResult = await l2Minting.wait();
    DEBUG(`L2 Token minted ${l2MintingResult.blockNumber}`);
    //L1 Mint mainnet token
    //L1 Relayer will be member of the mainnet multisig 1 of n that has registry manager role
    //L1 We calculate the call of createToken2 method on the l1 registry
    const l1MintingData = l1Registry.interface.encodeFunctionData("createToken2", [
        newTokenOwner,
        tokenName,
        tokenSymbol,
        `X${tokenSymbol}`,
        `X${tokenSymbol}`,
        merkletree.getHexRoot()
    ]);
    DEBUG(`L1 minting data payload ${l1MintingData}`);
    const l1Multisig = new ethers.Contract(l1MultisigWithRegistryManagerRole, gnosisSafeAbi, L1);
    const l1MultisigCurrentNonce = await l1Multisig.nonce();
    const l1MultisigVersion = await l1Multisig.VERSION();
    const l1TypedData = generateTypedData({
        chainId: 5,
        safeAddress: l1MultisigWithRegistryManagerRole,
        safeVersion: l1MultisigVersion,
        safeTransactionData: {
            to: l1Registry.address,
            value: '0',
            data: l1MintingData,
            baseGas: '0',
            gasPrice: '0',
            safeTxGas: '0',
            operation: '0',
            gasToken: '0x0000000000000000000000000000000000000000',
            refundReceiver: '0x0000000000000000000000000000000000000000',
            nonce: l1MultisigCurrentNonce
        }
    });
    const l1Signature = await L2._signTypedData(
        l1TypedData.domain,
        { SafeTx: l2TypedData.types.SafeTx },
        l1TypedData.message
    );
    DEBUG(`L1 Generated signature ${l1Signature}`)
    //L2 We mint token on mumbai by calling multisig contract, anyone can make this transaction
    const l1Minting = await l1Multisig.execTransaction(
        l1Registry.address,
        0,
        l1MintingData,
        0,
        0,
        0,
        0,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        l1Signature,
        {gasLimit: 2000000}
    );
    DEBUG(`L1 Token minting in progress ${l1Minting.hash}`);
    const l1MintingResult = await l1Minting.wait();
    DEBUG(`L1 Token minted ${l1MintingResult.blockNumber}`);
    //L1 Claim allocations (already automated in our infra for known tokens)
    const l1MintedToken = await attach("P00lsTokenCreator", predictedMainnetContract, {signer: L1});
    for(const allocation of allocations) {
        const allocationClaimInProgress = await l1MintedToken.claim(allocation.index, allocation.account, allocation.amount, merkletree.getHexProof(merkle.hashAllocation(allocation)), {gasLimit: 300000});
        DEBUG(`L1 allocation claim in progress ${allocationClaimInProgress.hash}`)
        const allocationClaimed = await allocationClaimInProgress.wait();
        DEBUG(`L1 allocation claimed ${allocationClaimed.blockNumber}`)
    }
    //L2 We whitelist the tokens vault to spend token
    //L2 We whitelist creator address so they can spend tokens
    //L2 We allow the relayer to spend coins on behalf of the tokens vault
    //TODO We get the created contract address

    DEBUG(`=== end ===`);
}

if (require.main === module) {
    const CONFIG = require('./config');
    const ENV    = require('./env');

    migrate(CONFIG, ENV)
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}