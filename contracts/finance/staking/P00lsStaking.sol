// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Timers.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@amxx/hre/contracts/Splitters.sol";
import "@amxx/hre/contracts/FullMath.sol";
import "../amm/UniswapV2Router02.sol";
import "../amm/libraries/Math.sol";

import "hardhat/console.sol";

contract P00lsStaking is AccessControl, Multicall {
    using Distributions for Distributions.Uint256;
    using Splitters     for Splitters.Splitter;
    using Timers        for Timers.Timestamp;

    bytes32 public  constant LOCK_MANAGER_ROLE = keccak256("LOCK_MANAGER_ROLE");
    uint64  public  constant DELAY             =      30 days;
    uint64  public  constant MIN_DURATION      = 3  * 30 days;
    uint64  public  constant MAX_DURATION      = 36 * 30 days;
    uint256 private constant EXTRA_FACTOR_BASE = 1e18; // sqrt(1e36) → double for 1 extra

    UniswapV2Router02 public immutable router;
    IERC20            public immutable pools;

    /*****************************************************************************************************************
     *                                                    Storage                                                    *
     *****************************************************************************************************************/
    struct Vault {
        Timers.Timestamp delay;
        uint256          value;
        uint256          extra;
    }

    struct Lock {
        Timers.Timestamp          delay;
        Splitters.Splitter        splitter;
        mapping(address => Vault) vaults;
    }

    mapping(IERC20 => Lock) private _locks;

    /*****************************************************************************************************************
     *                                                    Events                                                     *
     *****************************************************************************************************************/
    event LockSetup(IERC20 indexed token);
    event VaultSetup(IERC20 indexed token, address indexed account, uint64 expiration);
    event Deposit(IERC20 indexed token, address indexed account, uint256 amount, uint256 extra, uint256 newWeight);
    event Withdraw(IERC20 indexed token, address indexed account, address to, uint256 reward);

    /*****************************************************************************************************************
     *                                                   Modifiers                                                   *
     *****************************************************************************************************************/
    modifier onlyUnsetLock(IERC20 token) {
        require(_locks[token].delay.isUnset(), "Staking already configured");
        _;
    }

    modifier onlyActiveLock(IERC20 token) {
        require(_locks[token].delay.isPending(), "Staking not currently authorized for this token");
        _;
    }

    modifier onlyExpiredLock(IERC20 token) {
        require(_locks[token].delay.isExpired(), "Staking is not closed for this token");
        _;
    }

    modifier onlyUnsetVault(IERC20 token, address account) {
        require(_locks[token].vaults[account].delay.isUnset(), "Vault already configured");
        _;
    }

    modifier onlyActiveVault(IERC20 token, address account) {
        require(_locks[token].vaults[account].delay.isPending(), "Vault doesn't accept stake");
        _;
    }

    modifier onlyExpiredVault(IERC20 token, address account) {
        require(_locks[token].vaults[account].delay.isExpired(), "Vault is locked");
        _;
    }

    /*****************************************************************************************************************
     *                                                   Functions                                                   *
     *****************************************************************************************************************/
    constructor(address _admin, UniswapV2Router02 _router, IERC20 _pools)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        router   = _router;
        pools    = _pools;
    }

    function lockDetails(IERC20 token)
    public view returns (uint64 start, uint256 reward, uint256 totalWeight)
    {
        Lock storage lock = _locks[token];
        return (
            lock.delay.getDeadline(),
            SafeCast.toUint256(SafeCast.toInt256(lock.splitter._bounty) + lock.splitter._released._total),
            lock.splitter.totalSupply()
        );
    }

    function vaultDetails(IERC20 token, address account)
    public view returns (uint64 maturity, uint256 value, uint256 extra, uint256 weight)
    {
        Lock  storage lock  = _locks[token];
        Vault storage vault = lock.vaults[account];
        return (
            vault.delay.getDeadline(),
            vault.value,
            vault.extra,
            lock.splitter.balanceOf(account)
        );
    }

    function lockSetup(IERC20 token)
    public
        onlyUnsetLock(token)
        onlyRole(LOCK_MANAGER_ROLE)
    {
        Lock storage lock = _locks[token];

        lock.delay.setDeadline(uint64(block.timestamp) + DELAY);
        lock.splitter.reward(token.balanceOf(address(this)));

        emit LockSetup(token);
    }

    function vaultSetup(IERC20 token, uint64 duration)
    public
        onlyActiveLock(token)
        onlyUnsetVault(token, msg.sender)
    {
        require(duration >= MIN_DURATION);
        require(duration <= MAX_DURATION);

        Lock  storage lock  = _locks[token];
        Vault storage vault = lock.vaults[msg.sender];

        uint64 expiration = lock.delay.getDeadline() + duration;
        vault.delay.setDeadline(expiration);

        emit VaultSetup(token, msg.sender, expiration);
    }

    function deposit(IERC20 token, uint256 amount, uint256 extra, address to)
    public
        onlyActiveLock(token)
        onlyActiveVault(token, to)
    {
        Lock  storage lock  = _locks[token];
        Vault storage vault = lock.vaults[to];

        if (amount > 0) {
            // deposit tokens
            SafeERC20.safeTransferFrom(token, msg.sender, address(this), amount);
            vault.value += amount;
        }

        if (extra > 0) {
            // deposit tokens
            SafeERC20.safeTransferFrom(pools, msg.sender, address(this), extra);
            vault.extra += extra;
        }

        uint256 weight = _computeWeight(
            vault.value,
            FullMath.mulDiv(
                EXTRA_FACTOR_BASE + _extraFactor(token, vault.value, vault.extra),
                EXTRA_FACTOR_BASE,
                _vaultFactor(token, to)
            )
        );
        lock.splitter._shares._balances.set(to, weight);

        emit Deposit(token, to, amount, extra, weight);
    }

    function withdraw(IERC20 token, address to)
    public
        onlyExpiredVault(token, msg.sender)
    {
        Lock  storage lock  = _locks[token];
        Vault storage vault = lock.vaults[msg.sender];

        uint256 reward = lock.splitter.release(msg.sender);
        SafeERC20.safeTransferFrom(token, address(this), to, vault.value + reward);
        SafeERC20.safeTransferFrom(pools, address(this), to, vault.extra);

        delete lock.vaults[msg.sender];

        emit Withdraw(token, msg.sender, to, reward);
    }

    /*****************************************************************************************************************
     *                                                Internal tools                                                 *
     *****************************************************************************************************************/
    function _computeWeight(uint256 value, uint256 factor) public pure returns (uint256) {
        return FullMath.mulDiv(
            value,
            1e18,
            factor
        );
    }

    function _vaultFactor(IERC20 token, address account) internal view returns (uint256) {
        uint256 duration = _locks[token].vaults[account].delay.getDeadline() - _locks[token].delay.getDeadline();
        return FullMath.mulDiv(
            Math.sqrt(duration),
            MIN_DURATION,
            duration
        );
    }

    function _extraFactor(IERC20 token, uint256 value, uint256 extra) internal view returns (uint256) {
        return extra == 0 ? 0 : Math.sqrt(
            FullMath.mulDiv(
                router.getAmountsOut(extra, _poolsToToken(token))[2],
                value,
                1e36
            )
        );
    }

    function _tokenToPools(IERC20 token) internal view returns (address[] memory path) {
        path = new address[](3);
        path[0] = address(token);
        path[1] = router.WETH();
        path[2] = address(pools);
    }

    function _poolsToToken(IERC20 token) internal view returns (address[] memory path) {
        path = new address[](3);
        path[0] = address(pools);
        path[1] = router.WETH();
        path[2] = address(token);
    }
}