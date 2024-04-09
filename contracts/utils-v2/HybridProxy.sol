// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IBeacon}      from "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import {ERC1967Utils} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";
import {Proxy}        from "@openzeppelin/contracts/proxy/Proxy.sol";

/// @custom:security-contact security@p00ls.com
contract HybridProxy is Proxy {

    constructor(address implementation)
    {
        ERC1967Utils.upgradeToAndCall(implementation, "");
    }

    function _implementation()
        internal
        view
        override
        returns (address)
    {
        address implementation = ERC1967Utils.getImplementation();
        try IBeacon(implementation).implementation() returns (address result) {
            return result;
        } catch {
            return implementation;
        }
    }
}