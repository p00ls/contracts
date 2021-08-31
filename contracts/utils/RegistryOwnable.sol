// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

abstract contract RegistryOwnable {
    IERC721 public immutable ownershipRegistry;

    modifier onlyOwner() {
        require(owner() == msg.sender, "RegistryOwnable: caller is not the owner");
        _;
    }

    modifier onlyAdmin() {
        require(admin() == msg.sender, "RegistryOwnable: caller is not the admin");
        _;
    }

    constructor(address ownershipRegistry_) {
        ownershipRegistry = IERC721(ownershipRegistry_);
    }

    function owner() public view virtual returns (address) {
        return ownershipRegistry.ownerOf(uint256(uint160(address(this))));
    }

    function admin() public view virtual returns (address) {
        return ownershipRegistry.ownerOf(uint256(uint160(address(ownershipRegistry))));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        ownershipRegistry.transferFrom(owner(), newOwner, uint256(uint160(address(this))));
    }
}
