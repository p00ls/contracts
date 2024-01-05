require('dotenv/config');

const ethers                          = require("ethers");
const { POSClient, use, setProofApi } = require("@maticnetwork/maticjs");
const { Web3ClientPlugin }            = require("@maticnetwork/maticjs-web3");
const HDWalletProvider                = require("@truffle/hdwallet-provider");

const argv = require('yargs/yargs')(process.argv.slice(2))
    .env('')
    .options({
        network:   { type: 'string', choices: [ 'mainnet-v1', 'testnet-mumbai' ], default: 'testnet-mumbai'        },
        proofApi:  { type: 'string', default: 'https://apis.matic.network/'                                        },
        txHash:    { type: 'string', default: '0x0bfe5f44b5836f6ce1ad8bd43002f9f3d1dd4ebcfe5b4e7a2cff01ddc6c05949' },
        eventSig:  { type: 'string', default: 'MessageSent(bytes)'                                                 },
    })
    .argv;

use(Web3ClientPlugin);
setProofApi(argv.proofApi);

async function main() {
    const [ network, version ] = argv.network.split('-');

    // placeholder, no mnemonic actually needed.
    const mnemonic = 'test test test test test test test test test test test junk';

    const client = new POSClient();
    await client.init({
        network,
        version,
        parent: { provider: new HDWalletProvider({ mnemonic, url: argv.network === 'mainnet-v1' ? argv.mainnetNode : argv.goerliNode }) },
        child:  { provider: new HDWalletProvider({ mnemonic, url: argv.network === 'mainnet-v1' ? argv.maticNode   : argv.mumbaiNode }) },
    });

    const proof = await client.exitUtil.buildPayloadForExit(argv.txHash, ethers.utils.id(argv.eventSig), !!argv.proofApi);
    console.log(proof)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
