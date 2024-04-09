// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

library Conversion {
    function toUint256(address value) internal pure returns (uint256 result) {
        assembly { result := value }
    }

    function toBytes32(address value) internal pure returns (bytes32 result) {
        assembly { result := value }
    }
}