// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

abstract contract RegistryOwnableUpgradeable is Initializable {
    IERC721 public ownershipRegistry;

    modifier onlyOwner() {
        require(owner() == msg.sender, "RegistryOwnable: caller is not the owner");
        _;
    }

    function __RegistryOwnable_init(address ownershipRegistry_) public initializer {
        ownershipRegistry = IERC721(ownershipRegistry_);
    }

    function owner() public view virtual returns (address) {
        return ownershipRegistry.ownerOf(uint256(uint160(address(this))));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        ownershipRegistry.transferFrom(owner(), newOwner, uint256(uint160(address(this))));
    }
}
