// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "./StakingEscrow.sol";

function tokenID(IERC20 token) pure returns (uint256) {
    return uint256(uint160(address(token)));
}

contract Staking is ERC1155Supply, Multicall {
    StakingEscrow public immutable escrow;

    /*****************************************************************************************************************
     *                                                   Modifiers                                                   *
     *****************************************************************************************************************/
    modifier accrue(IERC20 token) {
        escrow.release(token);
        _;
    }

    /*****************************************************************************************************************
     *                                                   Functions                                                   *
     *****************************************************************************************************************/
    constructor(address _admin)
    ERC1155("")
    {
        escrow = new StakingEscrow(_admin);
    }

    function deposit(IERC20 token, uint256 value)
    public
    {
        depositFor(token, value, msg.sender);
    }

    function withdraw(IERC20 token, uint256 shares)
    public
    {
        withdrawTo(token, shares, msg.sender);
    }

    function depositFor(IERC20 token, uint256 value, address receiver)
    public accrue(token)
    {
        uint256 shares = valueToShares(token, value);

        SafeERC20.safeTransferFrom(token, msg.sender, address(this), value);
        _mint(receiver, tokenID(token), shares, new bytes(0)); // can re-enter
    }

    function withdrawTo(IERC20 token, uint256 shares, address receiver)
    public accrue(token)
    {
        uint256 value  = sharesToValue(token, shares);

        SafeERC20.safeTransfer(token, receiver, value);
        _burn(msg.sender, tokenID(token), shares); // can re-enter
    }

    function valueToShares(IERC20 token, uint256 value)
    public view returns (uint256)
    {
        uint256 supply  = totalSupply(tokenID(token));
        uint256 balance = token.balanceOf(address(this));
        return balance > 0 && supply > 0 ? FullMath.mulDiv(value, balance, supply) : value;
    }

    function sharesToValue(IERC20 token, uint256 shares)
    public view returns (uint256)
    {
        uint256 supply  = totalSupply(tokenID(token));
        uint256 balance = token.balanceOf(address(this));
        return balance > 0 && supply > 0 ? FullMath.mulDiv(shares, supply, balance) : supply;
    }
}