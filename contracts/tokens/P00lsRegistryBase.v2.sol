// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./P00lsRegistryBase.sol";

/// @custom:security-contact security@p00ls.com
contract P00lsRegistryBaseV2 is P00lsRegistryBase {
    // Give the admin the ability to move any token for recovery
    function _isApprovedOrOwner(address spender, uint256 tokenId)
        internal
        view
        virtual
        override
        returns (bool)
    {
        // here owner() == admin()
        return super._isApprovedOrOwner(spender, tokenId) || spender == owner();
    }
}
