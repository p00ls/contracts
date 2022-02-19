// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@amxx/hre/contracts/Checkpoints.sol";
import "@amxx/hre/contracts/FullMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../finance/staking/Escrow.sol";
import "./P00lsTokenBase.sol";
import "./interfaces.sol";

/// @custom:security-contact security@p00ls.com
contract P00lsTokenXCreator is
    P00lsTokenBase,
    ERC4626Upgradeable,
    IEscrowReceiver
{
    using Checkpoints for Checkpoints.History;

    Escrow              public immutable stakingEscrow;
    IP00lsTokenCreator  public           creatorToken;
    Checkpoints.History internal         conversion;

    modifier onlyOwner() {
        require(owner() == msg.sender, "P00lsTokenXCreator: owner restricted");
        _;
    }

    modifier onlyParent() {
        require(address(creatorToken) == msg.sender, "P00lsTokenXCreator: creator token restricted");
        _;
    }

    modifier accrue() {
        stakingEscrow.release(creatorToken);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address escrow)
        initializer()
    {
        stakingEscrow = Escrow(escrow);
    }

    function initialize(string calldata name, string calldata symbol, address parent)
        external
        initializer()
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        creatorToken = IP00lsTokenCreator(parent);

        // before escrow release, ratio is 1:1
        conversion.push(assetsPerShare());
    }

    function owner()
        public
        view
        override
        returns (address)
    {
        return creatorToken.owner();
    }

    function asset()
        public
        view
        override
        returns (address)
    {
        return address(creatorToken);
    }

    /**
     * Deposit / withdraw
     */
    function onEscrowRelease(uint256)
        public
    {
        uint256 value = assetsPerShare();
        if (value != conversion.latest())
        {
            conversion.push(value);
        }
    }

    function pastSharesToValue(uint256 shares, uint256 blockNumber)
        public
        view
        returns (uint256)
    {
        return FullMath.mulDiv(conversion.past(blockNumber), 10 ** decimals(), shares);
    }

    /**
     * Delegation
     */
    function __delegate(address delegator, address delegatee)
        external
        onlyParent()
    {
        _delegate(delegator, delegatee);
    }

    function delegate(address)
        public
        pure
        override
    {
        revert("P00lsTokenXCreator: delegation is registered on the creatorToken");
    }

    function delegateBySig(address, uint256, uint256, uint8, bytes32, bytes32)
        public
        pure
        override
    {
        revert("P00lsTokenXCreator: delegation is registered on the creatorToken");
    }

    /**
     * ERC4626 specialisation
     */
    function totalAssets() public view virtual override returns (uint256) {
        return super.totalAssets() + stakingEscrow.releasable(creatorToken);
    }

    function deposit(uint256 assets, address receiver) public virtual override accrue() returns (uint256) {
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public virtual override accrue() returns (uint256) {
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address holder) public virtual override accrue() returns (uint256) {
        return super.withdraw(assets, receiver, holder);
    }

    function redeem(uint256 shares, address receiver, address holder) public virtual override accrue() returns (uint256) {
        return super.redeem(shares, receiver, holder);
    }

    /**
     * Internal override resolution
     */
    function _mint(address account, uint256 amount)
        internal
        virtual
        override(ERC20Upgradeable, P00lsTokenBase)
    {
        super._mint(account, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        virtual
        override(ERC20Upgradeable, P00lsTokenBase)
    {
        super._burn(account, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        virtual
        override(ERC20Upgradeable, P00lsTokenBase)
    {
        super._afterTokenTransfer(from, to, amount);
    }
}
