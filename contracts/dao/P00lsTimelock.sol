// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-v4/governance/TimelockController.sol";
import "@openzeppelin/contracts-v4/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts-v4/token/ERC1155/utils/ERC1155Holder.sol";

/// @custom:security-contact security@p00ls.com
contract P00lsTimelock is TimelockController
{
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors
    )
        TimelockController(minDelay, proposers, executors, msg.sender)
    {}
}
