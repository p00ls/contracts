// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library BitMap {
    struct BitMap {
        mapping(uint256 => uint256) _data;
    }

    function isSet(BitMap storage bitmap, uint256 index) internal view returns (bool) {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        uint256 claimedWord = bitmap._data[claimedWordIndex];
        uint256 mask = (1 << claimedBitIndex);
        return claimedWord & mask == mask;
    }

    function set(BitMap storage bitmap, uint256 index) internal {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        bitmap._data[claimedWordIndex] = bitmap._data[claimedWordIndex] | (1 << claimedBitIndex);
    }

    function unset(BitMap storage bitmap, uint256 index) internal {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        bitmap._data[claimedWordIndex] = bitmap._data[claimedWordIndex] & ~(1 << claimedBitIndex);
    }
}
