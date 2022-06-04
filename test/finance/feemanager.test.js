const { ethers, network } = require('hardhat');
const { expect } = require('chai');

const { prepare, utils } = require('../fixture.js');

const VALUE = ethers.utils.parseEther('100');
const value = ethers.utils.parseEther('1');

describe('FeeManager', function () {
  prepare();

  before(async function () {
    this.accounts.artist = this.accounts.shift();
  });

  describe('with pair (p00ls <> eth)', function () {
    beforeEach(async function () {
      await this.token.transfer(this.auction.address, VALUE);

      const { timestamp: now } = await ethers.provider.getBlock('latest');
      this.auction_instance = await this.auction.start(this.token.address, now, 14 * 86400)
      .then(tx => tx.wait())
      .then(receipt => receipt.events.find(({ event }) => event === 'AuctionCreated'))
      .then(event => event.args.auction)
      .then(address => utils.attach('Auction', address));

      await this.accounts.admin.sendTransaction({ to: this.auction_instance.address, value });
      await network.provider.send('evm_increaseTime', [ 14 * 86400 ]);
      await this.auction.finalize(this.token.address);

      this.unipair = await this.factory.getPair(this.weth.address, this.token.address).then(address => utils.attach('UniswapV2Pair', address));
    });

    describe('with liquidity (p00ls <> eth)', function () {
      beforeEach(async function () {
        await this.token.connect(this.accounts.admin).approve(
          this.router.address,
          ethers.constants.MaxUint256,
        );
        // do a transfer to generate fees
        await this.router.swapExactETHForTokens(
          0,
          [ this.weth.address, this.token.address ],
          this.accounts.admin.address,
          ethers.constants.MaxUint256,
          { value: ethers.utils.parseEther('.1')},
        );
        // mint liquidity to realize fees
        await this.router.connect(this.accounts.admin).addLiquidityETH(
          this.token.address,
          ethers.utils.parseEther('.00001'),
          0,
          0,
          this.accounts.admin.address,
          ethers.constants.MaxUint256,
          { value: ethers.utils.parseEther('.00001') },
        );
      });

      it('liquidate fees', async function () {
        expect(await this.unipair.balanceOf(this.feemanager.address)).to.be.equal('803713105616875');
        expect(await this.feemanager.redistributedFees(this.weth.address))
        /* logindex  0 */ .to.emit(this.unipair,    'Approval'       ).withArgs(this.feemanager.address, this.router.address,          '803713105616875'                 ) // approve liquidity for burn
        /* logindex  1 */ .to.emit(this.unipair,    'Approval'       ).withArgs(this.feemanager.address, this.router.address,          0                                 ) // consume approval for burn
        /* logindex  2 */ .to.emit(this.unipair,    'Transfer'       ).withArgs(this.feemanager.address, this.unipair.address,         '803713105616875'                 ) // transfer for burn (done by router)
        /* logindex  3 */ .to.emit(this.unipair,    'Transfer'       ).withArgs(this.unipair.address,    ethers.constants.AddressZero, '803713105616875'                 ) // burn liquidity
        /* logindex  4 */ .to.emit(this.weth,       'Transfer'       ).withArgs(this.unipair.address,    this.feemanager.address,      '125014207774677'                 ) // liquidity exit (weth)
        /* logindex  5 */ .to.emit(this.token,      'Transfer'       ).withArgs(this.unipair.address,    this.feemanager.address,      '5168225547756320'                ) // liquidity exit (token)
        /* logindex  6 */ .to.emit(this.unipair,    'Sync'           ) // pair sync
        /* logindex  7 */ .to.emit(this.unipair,    'Burn'           ).withArgs(this.router.address, '125014207774677', '5168225547756320', this.feemanager.address      ) // burn signal
        /* logindex  8 */ .to.emit(this.weth,       'Approval'       ).withArgs(this.feemanager.address, this.router.address,          '125014207774677'                 ) // approve weth for swap
        /* logindex  9 */ .to.emit(this.weth,       'Approval'       ).withArgs(this.feemanager.address, this.router.address,          '125014207774677'                 ) // consume approve swap
        /* logindex 10 */ .to.emit(this.weth,       'Transfer'       ).withArgs(this.feemanager.address, this.unipair.address,         '125014207774677'                 ) // transfer for swap (done by router)
        /* logindex 11 */ .to.emit(this.token,      'Transfer'       ).withArgs(this.unipair.address,    this.feemanager.address,      '5141802913670611'                ) // transfer of token in exchange
        /* logindex 12 */ .to.emit(this.unipair,    'Sync'           ) // pair sync
        /* logindex 13 */ .to.emit(this.unipair,    'Swap'           ).withArgs(this.router.address, '125014207774677', 0, 0, '5141802913670611', this.feemanager.address) // swap signal
        /* logindex 14 */ .to.emit(this.feemanager, 'FeesLiquidated' ).withArgs(this.weth.address,       '803713105616875',            '10310028461426931'               ) // 10310028461426931 = 5168225547756320 + 5141802913670611
        /* logindex 15 */ .to.emit(this.token,      'Transfer'       ).withArgs(this.feemanager.address, this.xToken.address,          '10310028461426931'               ) // 10310028461426931 = 5168225547756320 + 5141802913670611
        /* logindex 16 */ .to.emit(this.feemanager, 'FeesToRecipient').withArgs(this.xToken.address,                                   '10310028461426931'               ) // 10310028461426931 = 5168225547756320 + 5141802913670611
      });
    });
  });

  describe('with pair (p00ls <> creator)', function () {
    beforeEach(async function () {
      this.allocations = [{ index: 0, account: this.auction.address, amount: VALUE }, { index: 1, account: this.accounts.admin.address, amount: VALUE }];
      this.merkletree = utils.merkle.createMerkleTree(this.allocations.map(utils.merkle.hashAllocation));
      this.creatorToken  = await this.workflows.newCreatorToken(this.accounts.artist.address, 'Hadrien Croubois', '$Amxx', 'X Hadrien Croubois', 'x$Amxx', this.merkletree.getRoot());
      this.xCreatorToken = await this.workflows.getXCreatorToken(this.creatorToken);
      await Promise.all(this.allocations.map(allocation => this.creatorToken.claim(allocation.index, allocation.account, allocation.amount, this.merkletree.getHexProof(utils.merkle.hashAllocation(allocation)))));

      const { timestamp: now } = await ethers.provider.getBlock('latest');
      this.auction_instance = await this.auction.start(this.creatorToken.address, now, 14 * 86400)
      .then(tx => tx.wait())
      .then(receipt => receipt.events.find(({ event }) => event === 'AuctionCreated'))
      .then(event => event.args.auction)
      .then(address => utils.attach('Auction', address));

      await this.token['transferAndCall(address,uint256)'](this.auction_instance.address, value);
      await network.provider.send('evm_increaseTime', [ 14 * 86400 ]);
      await this.auction.finalize(this.creatorToken.address);

      this.unipair = await this.factory.getPair(this.token.address, this.creatorToken.address).then(address => utils.attach('UniswapV2Pair', address));
    });

    describe('with liquidity (p00ls <> eth)', function () {
      beforeEach(async function () {
        await this.token.connect(this.accounts.admin).approve(this.router.address, ethers.constants.MaxUint256);
        await this.creatorToken.connect(this.accounts.admin).approve(this.router.address, ethers.constants.MaxUint256);
        // do a transfer to generate fees
        await this.router.swapExactTokensForTokens(
          ethers.utils.parseEther('.1'),
          0,
          [ this.creatorToken.address, this.token.address ],
          this.accounts.admin.address,
          ethers.constants.MaxUint256,
        );
        // mint liquidity to realize fees
        await this.router.connect(this.accounts.admin).addLiquidity(
          this.creatorToken.address,
          this.token.address,
          ethers.utils.parseEther('.00001'),
          ethers.utils.parseEther('.00001'),
          0,
          0,
          this.accounts.admin.address,
          ethers.constants.MaxUint256,
        );
      });

      it('liquidate fees', async function () {
        expect(await this.unipair.balanceOf(this.feemanager.address)).to.be.equal('17642472796546');
        expect(await this.feemanager.redistributedFees(this.creatorToken.address))
        /* logindex  0 */ .to.emit(this.unipair,      'Approval'       ).withArgs(this.feemanager.address,   this.router.address,          '17642472796546'                ) // approve liquidity for burn
        /* logindex  1 */ .to.emit(this.unipair,      'Approval'       ).withArgs(this.feemanager.address,   this.router.address,          0                               ) // consume approval for burn
        /* logindex  2 */ .to.emit(this.unipair,      'Transfer'       ).withArgs(this.feemanager.address,   this.unipair.address,         '17642472796546'                ) // transfer for burn (done by router)
        /* logindex  3 */ .to.emit(this.unipair,      'Transfer'       ).withArgs(this.unipair.address,      ethers.constants.AddressZero, '17642472796546'                ) // burn liquidity
        /* logindex  4 */ .to.emit(this.token,        'Transfer'       ).withArgs(this.unipair.address,      this.feemanager.address,      '2490060983788'                 ) // liquidity exit (weth)
        /* logindex  5 */ .to.emit(this.creatorToken, 'Transfer'       ).withArgs(this.unipair.address,      this.feemanager.address,      '125000311877813'               ) // liquidity exit (token)
        /* logindex  6 */ .to.emit(this.unipair,      'Sync'           ) // pair sync
        /* logindex  7 */ .to.emit(this.unipair,      'Burn'           ).withArgs(this.router.address, '2490060983788', '125000311877813', this.feemanager.address         ) // burn signal
        /* logindex  8 */ .to.emit(this.creatorToken, 'Approval'       ).withArgs(this.feemanager.address,   this.router.address,          '125000311877813'               ) // approve weth for swap
        /* logindex  9 */ .to.emit(this.creatorToken, 'Approval'       ).withArgs(this.feemanager.address,   this.router.address,          '125000311877813'               ) // consume approve swap
        /* logindex 10 */ .to.emit(this.creatorToken, 'Transfer'       ).withArgs(this.feemanager.address,   this.unipair.address,         '125000311877813'               ) // transfer for swap (done by router)
        /* logindex 11 */ .to.emit(this.token,        'Transfer'       ).withArgs(this.unipair.address,      this.feemanager.address,      '2477604528100'                 ) // transfer of token in exchange
        /* logindex 12 */ .to.emit(this.unipair,      'Sync'           ) // pair sync
        /* logindex 13 */ .to.emit(this.unipair,      'Swap'           ).withArgs(this.router.address, 0,    '125000311877813', '2477604528100', 0, this.feemanager.address) // swap signal
        /* logindex 14 */ .to.emit(this.feemanager,   'FeesLiquidated' ).withArgs(this.creatorToken.address, '17642472796546',             '4967665511888'                 ) // 4967665511888 = 2490060983788 + 2477604528100
        /* logindex 15 */ .to.emit(this.token,        'Transfer'       ).withArgs(this.feemanager.address,   this.accounts.artist.address, '3974132409510'                 ) // 3974132409510 = 80% * 4967665511888
        /* logindex 16 */ .to.emit(this.feemanager,   'FeesToOwner'    ).withArgs(this.accounts.artist.address,                            '3974132409510'                 ) // 3974132409510 = 80% * 4967665511888
        /* logindex 17 */ .to.emit(this.token,        'Transfer'       ).withArgs(this.feemanager.address,   this.xToken.address,          '993533102378'                  ) // 993533102378 = 20% * 4967665511888
        /* logindex 18 */ .to.emit(this.feemanager,   'FeesToRecipient').withArgs(this.xToken.address,                                     '993533102378'                  ) // 993533102378 = 20% * 4967665511888
      });
    });
  });
});
