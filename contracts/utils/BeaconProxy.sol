// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import "@openzeppelin/contracts/proxy/Proxy.sol";

/// @custom:security-contact security@p00ls.com
contract BeaconProxy is Proxy {
    IBeacon private immutable _beacon;

    event BeaconUpgraded(IBeacon indexed beacon);

    constructor(IBeacon beacon)
    {
        _beacon = beacon;
        emit BeaconUpgraded(beacon);
    }

    function _implementation()
        internal
        view
        override
        returns (address)
    {
        return _beacon.implementation();
    }
}
