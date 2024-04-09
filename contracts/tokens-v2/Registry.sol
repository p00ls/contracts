// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Conversion}   from "../utils-v2/Conversion.sol";
import {RegistryBase} from "./RegistryBase.sol";
import {Token}        from "./Token.sol";

/// @custom:security-contact security@p00ls.com
contract Registry is RegistryBase {
    using Conversion for address;

    function createToken(address owner, string calldata name, string calldata symbol, bytes32 root)
        external
        onlyRole(REGISTRY_MANAGER_ROLE)
        returns (address)
    {
        address token = _createProxy(address(this));
        _mint(owner, token.toUint256());

        Token(token).initialize(
            name,
            symbol,
            root
        );

        return token;
    }

    function createToken2(address owner, string calldata name, string calldata symbol, bytes32 root)
        external
        onlyRole(REGISTRY_MANAGER_ROLE)
        returns (address)
    {
        bytes32 salt  = keccak256(abi.encodePacked(name, symbol, root));
        address token = _createProxy(address(this), salt);
        _mint(owner, token.toUint256());

        Token(token).initialize(
            name,
            symbol,
            root
        );

        return token;
    }

    function predictToken2(string calldata name, string calldata symbol, bytes32 root)
        external
        view
        returns (address)
    {
        return _predictProxy(address(this), keccak256(abi.encodePacked(name, symbol, root)));
    }
}