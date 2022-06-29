const { ethers } = require('hardhat');
const { expect } = require('chai');

const { prepare, utils } = require('../fixture.js');

describe('ENS', function () {
  prepare();

  before(async function () {
    this.provider     = new ethers.providers.FallbackProvider([ ethers.provider ]);

    this.ens = {};
    this.ens.admin = this.accounts.shift();
  });

  beforeEach(async function () {
    this.ens.registry = await utils.deploy('ENSRegistry',                                                                   { signer: this.ens.admin });
    this.ens.resolver = await utils.deploy('PublicResolver',   [ this.ens.registry.address, ethers.constants.AddressZero ], { signer: this.ens.admin });
    this.ens.reverse  = await utils.deploy('ReverseRegistrar', [ this.ens.registry.address, this.ens.resolver.address    ], { signer: this.ens.admin });

    this.provider.network.ensAddress = this.ens.registry.address;

    await this.ens.registry.setSubnodeRecord(ethers.utils.namehash(''       ), ethers.utils.id('eth'    ), this.ens.admin.address,      this.ens.resolver.address, 0).then(tx => tx.wait());
    await this.ens.registry.setSubnodeRecord(ethers.utils.namehash('eth'    ), ethers.utils.id('p00ls'  ), this.accounts.admin.address, this.ens.resolver.address, 0).then(tx => tx.wait());
    await this.ens.registry.setSubnodeRecord(ethers.utils.namehash(''       ), ethers.utils.id('reverse'), this.ens.admin.address,      this.ens.resolver.address, 0).then(tx => tx.wait());
    await this.ens.registry.setSubnodeRecord(ethers.utils.namehash('reverse'), ethers.utils.id('addr'   ), this.ens.reverse.address,    this.ens.resolver.address, 0).then(tx => tx.wait());
  });

  describe('setName', function () {
    for (const { contract, name, user } of [
      { contract: 'registry',      name: 'registry', user: 'superAdmin' },
      { contract: 'token',         name: 'token',    user: 'admin'      },
      { contract: 'xToken',        name: 'xToken',   user: 'admin'      },
      { contract: 'vestedAirdrop', name: 'vesting',  user: 'superAdmin' },
      { contract: 'escrow',        name: 'escrow',   user: 'superAdmin' },
      { contract: 'auction',       name: 'auction',  user: 'superAdmin' },
      { contract: 'locking',       name: 'locking',  user: 'superAdmin' },
    ]) {
      it(`setName for ${name}`, async function () {
        // create subdomain
        await expect(this.ens.registry.connect(this.accounts.admin).setSubnodeRecord(
          ethers.utils.namehash('p00ls.eth'),
          ethers.utils.id(name.toLowerCase()),
          this.accounts.admin.address,
          this.ens.resolver.address,
          0,
        )).to.be.not.reverted;

        // configure subdomain
        await expect(this.ens.resolver.connect(this.accounts.admin)['setAddr(bytes32,address)'](
            ethers.utils.namehash(`${name}.p00ls.eth`),
            this.contracts[contract].address,
        )).to.be.not.reverted;

        // setname
        await expect(this.contracts[contract].connect(this.accounts[user]).setName(
          this.ens.registry.address,
          `${name}.p00ls.eth`,
        )).to.be.not.reverted;

        // setname is protected
        await expect(this.contracts[contract].connect(this.ens.admin).setName(
          this.ens.registry.address,
          `${name}.p00ls.eth`,
        )).to.be.reverted;

        expect(await this.provider.resolveName(`${name}.p00ls.eth`))
          .to.be.equal(this.contracts[contract].address);

        expect(await this.provider.lookupAddress(this.contracts[contract].address))
          .to.be.equal(`${name}.p00ls.eth`);
      });
    }
  });
});
