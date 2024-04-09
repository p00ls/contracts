// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IBeacon} from "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";

/// @custom:security-contact security@p00ls.com
contract Beacon is IBeacon {
    address private _implementation;

    event Upgraded(address indexed implementation);

    function implementation()
        public
        view
        override
        returns (address)
    {
        return _implementation;
    }

    function _setImplementation(address newImplementation)
        internal
    {
        require(newImplementation.code.length > 0, "Beacon: implementation is not a contract");
        _implementation = newImplementation;
        emit Upgraded(newImplementation);
    }
}