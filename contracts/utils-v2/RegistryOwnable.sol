// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC721}       from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Conversion}    from "./Conversion.sol";

/// @custom:security-contact security@p00ls.com
abstract contract RegistryOwnable {
    using Conversion for address;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IERC721 public immutable ownershipRegistry;

    modifier onlyOwner() {
        require(owner() == msg.sender, "RegistryOwnable: caller is not the owner");
        _;
    }

    modifier onlyAdmin() {
        require(admin() == msg.sender, "RegistryOwnable: caller is not the admin");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
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
        return ownershipRegistry.ownerOf(address(this).toUint256());
    }

    function admin()
        public
        view
        virtual
        returns (address)
    {
        return ownershipRegistry.ownerOf(address(ownershipRegistry).toUint256());
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        ownershipRegistry.transferFrom(owner(), newOwner, address(this).toUint256());
    }
}