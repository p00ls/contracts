// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IBeacon} from "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import {StorageSlot} from "@openzeppelin/contracts/utils/StorageSlot.sol";

/// @custom:security-contact security@p00ls.com
contract BeaconUpgradeable is IBeacon {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("p00ls.storage.Beacon")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant BeaconStorageLocation = 0x7616e0b237e47d7000ccce1cfebe10be833a2b44ccbf1c9674840131d9639600;

    event Upgraded(address indexed implementation);

    function implementation()
        public
        view
        override
        returns (address)
    {
        return BeaconStorageLocation.getAddressSlot().value;
    }

    function _setImplementation(address newImplementation)
        internal
    {
        require(newImplementation.code.length > 0, "Beacon: implementation is not a contract");
        BeaconStorageLocation.getAddressSlot().value = newImplementation;
        emit Upgraded(newImplementation);
    }
}