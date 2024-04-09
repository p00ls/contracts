// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC721}       from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {StorageSlot}   from "@openzeppelin/contracts/utils/StorageSlot.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Conversion}    from "./Conversion.sol";

/// @custom:security-contact security@p00ls.com
abstract contract RegistryOwnableUpgradeable is Initializable {
    using StorageSlot for bytes32;
    using Conversion for address;

    // keccak256(abi.encode(uint256(keccak256("p00ls.storage.RegistryOwnable")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant RegistryOwnableStorageLocation = 0x578413847cfeef40f66ecbade5089dbd08bbe351d7244853be1a6e3c40f4db00;

    modifier onlyOwner() {
        require(owner() == msg.sender, "RegistryOwnable: caller is not the owner");
        _;
    }

    modifier onlyAdmin() {
        require(admin() == msg.sender, "RegistryOwnable: caller is not the admin");
        _;
    }

    function __RegistryOwnable_init(address ownershipRegistry_)
        internal
        initializer
    {
        StorageSlot.AddressSlot storage $ = RegistryOwnableStorageLocation.getAddressSlot();
        $.value = ownershipRegistry_;
    }

    function owner()
        public
        view
        virtual
        returns (address)
    {
        StorageSlot.AddressSlot storage $ = RegistryOwnableStorageLocation.getAddressSlot();
        return IERC721($.value).ownerOf(address(this).toUint256());
    }

    function admin()
        public
        view
        virtual
        returns (address)
    {
        StorageSlot.AddressSlot storage $ = RegistryOwnableStorageLocation.getAddressSlot();
        return IERC721($.value).ownerOf($.value.toUint256());
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        StorageSlot.AddressSlot storage $ = RegistryOwnableStorageLocation.getAddressSlot();
        IERC721($.value).transferFrom(owner(), newOwner, address(this).toUint256());
    }
}