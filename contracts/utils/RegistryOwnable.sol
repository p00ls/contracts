// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

function addressToUint256(address a) pure returns (uint256) {
    return uint256(uint160(a));
}

function uint256ToAddress(uint256 i) pure returns (address) {
    return address(uint160(i));
}

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

    constructor(address ownershipRegistry_)
    {
        ownershipRegistry = IERC721(ownershipRegistry_);
    }

    function owner()
        public
        view
        virtual
        returns (address)
    {
        return ownershipRegistry.ownerOf(addressToUint256(address(this)));
    }

    function admin()
        public
        view
        virtual
        returns (address)
    {
        return ownershipRegistry.ownerOf(addressToUint256(address(ownershipRegistry)));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        ownershipRegistry.transferFrom(owner(), newOwner, uint256(uint160(address(this))));
    }
}

abstract contract RegistryOwnableUpgradeable is Initializable {
    IERC721 public ownershipRegistry;

    modifier onlyOwner() {
        require(owner() == msg.sender, "RegistryOwnable: caller is not the owner");
        _;
    }

    modifier onlyAdmin() {
        require(admin() == msg.sender, "RegistryOwnable: caller is not the admin");
        _;
    }

    function __RegistryOwnable_init(address ownershipRegistry_)
        public
        initializer
    {
        ownershipRegistry = IERC721(ownershipRegistry_);
    }

    function owner()
        public
        view
        virtual
        returns (address)
    {
        return ownershipRegistry.ownerOf(addressToUint256(address(this)));
    }

    function admin()
        public
        view
        virtual
        returns (address)
    {
        return ownershipRegistry.ownerOf(addressToUint256(address(ownershipRegistry)));
    }

    function transferOwnership(address newOwner)
        public
        virtual
        onlyOwner
    {
        ownershipRegistry.transferFrom(owner(), newOwner, uint256(uint160(address(this))));
    }
}
