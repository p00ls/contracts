// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {StorageSlot}   from "@openzeppelin/contracts/utils/StorageSlot.sol";
import "./IERC1046.sol";

/// @custom:security-contact security@p00ls.com
abstract contract ERC1046Upgradeable is IERC1046 {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("p00ls.storage.ERC1046")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ERC1046StorageLocation = 0xfa4c28ceea4a677cc730bdcea1516bb1dcea5b41654336ec690a44a09f6e2500;

    function tokenURI() public view override returns (string memory) {
        return ERC1046StorageLocation.getStringSlot().value;
    }

    function _setTokenURI(string calldata _tokenURI) internal {
        ERC1046StorageLocation.getStringSlot().value = _tokenURI;
    }
}
