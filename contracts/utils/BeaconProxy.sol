// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/proxy/Proxy.sol";

contract BeaconProxy is Proxy {
    IBeacon private immutable _beacon;

    constructor(IBeacon beacon)
    {
        _beacon = beacon;
    }

    function _implementation()
        internal
        view
        override
        returns (address)
    {
        return IBeacon(_beacon).implementation();
    }
}
