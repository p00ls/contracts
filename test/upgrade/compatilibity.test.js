const { ethers, upgrades } = require('hardhat');

describe('Upgrade consistency', function () {
    it('P00lsTokenXCreator → P00lsTokenXCreatorV2', async function () {
        const proxy = await ethers.getContractFactory('P00lsTokenXCreator').then(factory => upgrades.deployProxy(
            factory,
            [ 'name', 'symbol', ethers.constants.AddressZero ],
            { constructorArgs: [ ethers.constants.AddressZero ], unsafeAllow: 'delegatecall' },
        ));

        await ethers.getContractFactory('P00lsTokenXCreatorV2').then(factory => upgrades.upgradeProxy(
            proxy,
            factory,
            { constructorArgs: [ ethers.constants.AddressZero ], unsafeAllow: 'delegatecall' },
        ));
    });
});
