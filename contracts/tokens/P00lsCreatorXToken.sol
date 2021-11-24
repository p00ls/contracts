// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@amxx/hre/contracts/FullMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../finance/staking/Escrow.sol";
import "./P00lsTokenBase.sol";
import "./interfaces.sol";


// TODO: use onlyOwner to perform admin operations
contract P00lsCreatorXToken is P00lsTokenBase
{
    Escrow             public immutable stakingEscrow;
    IP00lsCreatorToken public           creatorToken;

    modifier onlyOwner() {
        require(owner() == msg.sender, "P00lsCreatorXToken: owner restricted");
        _;
    }

    modifier onlyParent() {
        require(address(creatorToken) == msg.sender, "P00lsCreatorXToken: creator token restricted");
        _;
    }

    modifier accrue() {
        stakingEscrow.release(creatorToken);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address escrow)
    initializer
    {
        stakingEscrow = Escrow(escrow);
    }

    function initialize(string calldata name, string calldata symbol, address parent)
    external initializer
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        creatorToken = IP00lsCreatorToken(parent);
    }

    function owner() public view virtual override returns (address)
    {
        return creatorToken.owner();
    }

    /**
     * Deposit / withdraw
     */
    function deposit(uint256 value)
    public virtual
    {
        depositFor(value, msg.sender);
    }

    function withdraw(uint256 shares)
    public virtual
    {
        withdrawTo(shares, msg.sender);
    }

    function depositFor(uint256 value, address receiver)
    public virtual accrue()
    {
        uint256 shares = valueToShares(value);

        SafeERC20.safeTransferFrom(IERC20(creatorToken), msg.sender, address(this), value);
        _mint(receiver, shares);
    }

    function withdrawTo(uint256 shares, address receiver)
    public virtual accrue()
    {
        uint256 value  = sharesToValue(shares);

        _burn(msg.sender, shares);
        SafeERC20.safeTransfer(IERC20(creatorToken), receiver, value);
    }

    function valueToShares(uint256 value)
    public view virtual returns (uint256)
    {
        uint256 supply  = totalSupply();
        uint256 balance = IERC20(creatorToken).balanceOf(address(this));
        return balance > 0 && supply > 0 ? FullMath.mulDiv(value, balance, supply) : value;
    }

    function sharesToValue(uint256 shares)
    public view virtual returns (uint256)
    {
        uint256 supply  = totalSupply();
        uint256 balance = IERC20(creatorToken).balanceOf(address(this));
        return balance > 0 && supply > 0 ? FullMath.mulDiv(shares, supply, balance) : supply;
    }

    /**
     * Delegation
     */
    function __delegate(address delegator, address delegatee)
    external virtual onlyParent()
    {
        _delegate(delegator, delegatee);
    }

    function delegate(address)
    public virtual override
    {
        revert("delegation is registered on the creatorToken");
    }

    function delegateBySig(address, uint256, uint256, uint8, bytes32, bytes32)
    public virtual override
    {
        revert("delegation is registered on the creatorToken");
    }
}
