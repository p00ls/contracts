const { ethers } = require('hardhat');
const { expect, util } = require('chai');

const { prepare, utils } = require('../fixture.js');

const name = 'MockName';
const symbol = 'MckSmbl';
const uri = 'https://someapi.com/tokenId/';
const fee = ethers.utils.parseEther('1.0');

const FACTORY = { address: '0x4e59b44847b379578588920ca78fbf26c0b4956c', tx: '0xf8a58085174876e800830186a08080b853604580600e600039806000f350fe7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf31ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222' };
const REGISTRY = { address: '0x000000006551c19487814612e58FE06813775758', data: '0x0000000000000000000000000000000000000000fd8eb4e1dca713016c518e31608060405234801561001057600080fd5b5061023b806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063246a00211461003b5780638a54c52f1461006a575b600080fd5b61004e6100493660046101b7565b61007d565b6040516001600160a01b03909116815260200160405180910390f35b61004e6100783660046101b7565b6100e1565b600060806024608c376e5af43d82803e903d91602b57fd5bf3606c5285605d52733d60ad80600a3d3981f3363d3d373d3d3d363d7360495260ff60005360b76055206035523060601b60015284601552605560002060601b60601c60005260206000f35b600060806024608c376e5af43d82803e903d91602b57fd5bf3606c5285605d52733d60ad80600a3d3981f3363d3d373d3d3d363d7360495260ff60005360b76055206035523060601b600152846015526055600020803b61018b578560b760556000f580610157576320188a596000526004601cfd5b80606c52508284887f79f19b3655ee38b1ce526556b7731a20c8f218fbda4a3990b6cc4172fdf887226060606ca46020606cf35b8060601b60601c60005260206000f35b80356001600160a01b03811681146101b257600080fd5b919050565b600080600080600060a086880312156101cf57600080fd5b6101d88661019b565b945060208601359350604086013592506101f46060870161019b565b94979396509194608001359291505056fea2646970667358221220ea2fe53af507453c64dd7c1db05549fa47a298dfb825d6d11e1689856135f16764736f6c63430008110033' };

describe('$Crea Token', function () {
  prepare();

  before(async function () {
    this.accounts.beneficiary = this.accounts.shift();
    this.accounts.user        = this.accounts.shift();
    this.accounts.other       = this.accounts.shift();
  });

  beforeEach(async function () {
    // Deploy factory at 0x4e59b44847b379578588920ca78fbf26c0b4956c
    const { from, gasPrice, gasLimit } = ethers.utils.parseTransaction(FACTORY.tx);
    await this.accounts.admin.sendTransaction({ to: from, value: gasPrice.mul(gasLimit) });
    await ethers.provider.sendTransaction(FACTORY.tx);
    // Deploy ERC-6551 registry
    await this.accounts.admin.sendTransaction({ to: FACTORY.address, data: REGISTRY.data });
    this.registry = await utils.attach('ERC6551Registry', REGISTRY.address);

    // Mock
    this.mock = await utils.deploy('GiftCardRegistry', [name, symbol]);
    await this.mock.setBeneficiary(this.accounts.beneficiary.address);
    await this.mock.setMintFee(fee);
    await this.mock.setBaseURI(uri);

    this.implementation = await this.mock.implementation();
    this.chainId = await ethers.provider.getNetwork().then(({ chainId }) => chainId);

    this.getAccount = (tokenId) => this.registry.account(
      this.implementation,
      ethers.constants.HashZero,
      this.chainId,
      this.mock.address,
      tokenId,
    ).then(address => utils.attach('ERC6551Account', address));
  });

  it('sanity: registry exists', async function () {
    expect(await ethers.provider.getCode(FACTORY.address)).to.not.equal('0x');
    expect(await ethers.provider.getCode(REGISTRY.address)).to.not.equal('0x');
  });

  it('deployment check', async function () {
    expect(await this.mock.name()).to.equal(name);
    expect(await this.mock.symbol()).to.equal(symbol);
    expect(await this.mock.owner()).to.equal(this.accounts.admin.address);
    expect(await this.mock.registry()).to.equal(REGISTRY.address);
    expect(await this.mock.beneficiary()).to.equal(this.accounts.beneficiary.address);
    expect(await this.mock.mintFee()).to.equal(fee);
    expect(await this.mock.newTokenId()).to.equal(0n);
  });

  describe('mint', function () {
    it('missing fees', async function () {
      await expect(this.mock.connect(this.accounts.user).mint(this.accounts.user.address, { value: 0n }))
        .to.be.revertedWith('Invalid payment');
    });

    describe('with fees', function () {
      it('transfers eth to beneficiary', async function () {
        await expect(() => this.mock.connect(this.accounts.user).mint(this.accounts.user.address, { value: fee }))
          .to.changeEtherBalances([ this.accounts.user, this.accounts.beneficiary ], [ fee.mul(-1), fee ])
      });

      it('mint token and creates account', async function () {
        for (const _ of Array(10).fill()) {
          const tokenId = await this.mock.newTokenId();
          const tokenAccount = await this.getAccount(tokenId);

          // check account does not exist
          expect(await ethers.provider.getCode(tokenAccount.address)).to.equal('0x');

          // check mint does not revert
          await expect(this.mock.connect(this.accounts.user).mint(this.accounts.user.address, { value: fee }))
            .to.emit(this.mock, 'Transfer')
            .withArgs(ethers.constants.AddressZero, this.accounts.user.address, tokenId)
            .to.emit(this.registry, 'ERC6551AccountCreated')
            .withArgs(tokenAccount.address, this.implementation, ethers.constants.HashZero, this.chainId, this.mock.address, tokenId);

          expect(await this.mock.tokenURI(tokenId)).to.equal(uri + tokenId.toString());

          // check account creation
          expect(await ethers.provider.getCode(tokenAccount.address)).to.not.equal('0x');
        }
      });

      it('does not revert if account is already created', async function () {
        const tokenId = await this.mock.newTokenId();
        const tokenAccount = await this.getAccount(tokenId);

        // create account in anticipation
        await expect(this.registry.createAccount(this.implementation, ethers.constants.HashZero, this.chainId, this.mock.address, tokenId))
          .to.emit(this.registry, 'ERC6551AccountCreated')
          .withArgs(tokenAccount.address, this.implementation, ethers.constants.HashZero, this.chainId, this.mock.address, tokenId);

        // check account creation
        expect(await ethers.provider.getCode(tokenAccount.address)).to.not.equal('0x');

        // check mint does not revert
        await expect(this.mock.connect(this.accounts.user).mint(this.accounts.user.address, { value: fee }))
          .to.emit(this.mock, 'Transfer')
          .withArgs(ethers.constants.AddressZero, this.accounts.user.address, tokenId)
          .to.not.emit(this.registry, 'ERC6551AccountCreated')
      });

      it('too much fees', async function () {
        const tokenId = await this.mock.newTokenId();
        const tokenAccount = await this.getAccount(tokenId);

        await expect(() => this.mock.connect(this.accounts.user).mint(this.accounts.user.address, { value: fee.add(100) }))
          .to.changeEtherBalances([ this.accounts.user, this.accounts.beneficiary, tokenAccount ], [ fee.add(100).mul(-1), fee, 100 ])
      });
    });
  });

  describe('admin operation', function () {
    beforeEach(async function () {
      await this.mock.mint(this.accounts.user.address, { value: fee });
    });

    describe('URI', function () {
      const newURI = 'https://someotherapi.com/';

      it('admin can update URI', async function () {
        expect(await this.mock.tokenURI(0)).to.equal(uri + '0');

        await expect(this.mock.connect(this.accounts.admin).setBaseURI(newURI))
          .to.emit(this.mock, 'BatchMetadataUpdate')
          .withArgs(0, ethers.constants.MaxUint256);

          expect(await this.mock.tokenURI(0)).to.equal(newURI + '0');
        });

      it('other cannot update URI', async function () {
        await expect(this.mock.connect(this.accounts.other).setBaseURI(newURI))
          .to.be.revertedWith('Ownable: caller is not the owner');
      });

    });
    describe('beneficiary', function () {
      it('admin can update beneficiary', async function () {
        await expect(this.mock.connect(this.accounts.admin).setBeneficiary(this.accounts.other.address))
          .to.emit(this.mock, 'BeneficiaryUpdate')
          .withArgs(this.accounts.other.address);

        expect(await this.mock.beneficiary()).to.equal(this.accounts.other.address);
      });

      it('other cannot update beneficiary', async function () {
        await expect(this.mock.connect(this.accounts.other).setBeneficiary(this.accounts.other.address))
          .to.be.revertedWith('Ownable: caller is not the owner');
      });
    });
    describe('mint fee', function () {
      const newMintFee = 1337n;

      it('admin can update mint fee', async function () {
        await expect(this.mock.connect(this.accounts.admin).setMintFee(newMintFee))
          .to.emit(this.mock, 'MintFeeUpdate')
          .withArgs(newMintFee);

        expect(await this.mock.mintFee()).to.equal(newMintFee);
      });

      it('other cannot update mint fee', async function () {
        await expect(this.mock.connect(this.accounts.other).setMintFee(newMintFee))
          .to.be.revertedWith('Ownable: caller is not the owner');
      });
    });
  });
});