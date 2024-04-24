// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Conversion}          from "../utils-v2/Conversion.sol";
import {P00lsV2RegistryBase} from "./P00lsV2RegistryBase.sol";
import {P00lsV2Token}        from "./P00lsV2Token.sol";

/// @custom:security-contact security@p00ls.com
contract P00lsV2Registry is P00lsV2RegistryBase {
    using Conversion for address;

    function createToken(address owner, string calldata name, string calldata symbol, bytes32 root)
        external
        onlyRole(REGISTRY_MANAGER_ROLE)
        returns (address)
    {
        address token = _createProxy(address(this), abi.encodeCall(P00lsV2Token.initialize, (name, symbol, root)));
        _mint(owner, token.toUint256());

        return token;
    }

    function createToken2(address owner, string calldata name, string calldata symbol, bytes32 root)
        external
        onlyRole(REGISTRY_MANAGER_ROLE)
        returns (address)
    {
        address token = _createProxyDeterministic(address(this), abi.encodeCall(P00lsV2Token.initialize, (name, symbol, root)));
        _mint(owner, token.toUint256());

        return token;
    }

    function predictToken2(string calldata name, string calldata symbol, bytes32 root)
        external
        view
        returns (address)
    {
        return _predictProxy(address(this), abi.encodeCall(P00lsV2Token.initialize, (name, symbol, root)));
    }

    /// Token URI customization
    function setBaseURI(string memory baseURI)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setBaseURI(baseURI);
    }

    // Token upgrade
    function upgradeTokens(address newImplementation)
        external
        onlyRole(UPGRADER_ROLE)
    {
        _setImplementation(newImplementation);
    }
}