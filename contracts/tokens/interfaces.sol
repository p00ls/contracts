// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./extensions/IERC1046.sol";
import "./extensions/IERC1363.sol";

interface IP00lsTokenBase is IERC20, IERC1046, IERC1363
{
    function owner() external view returns (address);
    function setTokenURI(string calldata) external;
    function setName(address, string calldata) external;
}

interface IP00lsTokenCreator is IP00lsTokenBase {
    function xCreatorToken() external view returns (address);
    function merkleRoot() external view returns (bytes32);
    function isClaimed(uint256) external view returns (bool);
    function claim(uint256, address, uint256, bytes32[] calldata) external;
}

interface IP00lsTokenXCreator is IP00lsTokenBase {
    function creatorToken() external view returns (address);
    function escrow() external view returns (address);
    function deposit(uint256) external;
    function withdraw(uint256) external;
    function depositFor(uint256, address) external;
    function withdrawTo(uint256, address) external;
    function valueToShares(uint256) external view returns (uint256);
    function sharesToValue(uint256) external view returns (uint256);
    function __delegate(address, address) external;
}