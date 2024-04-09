// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/// @custom:security-contact security@p00ls.com
abstract contract AccessControlOwnedUpgradeable is AccessControlUpgradeable {
    function owner() public view virtual returns (address);

    function hasRole(bytes32 role, address account)
        public
        view
        virtual
        override
        returns (bool)
    {
        return (role != DEFAULT_ADMIN_ROLE && super.hasRole(role, account)) || account == owner();
    }

    function _grantRole(bytes32 role, address account)
        internal
        virtual
        override
        returns (bool)
    {
        require(role != DEFAULT_ADMIN_ROLE, "Admin role is managed by NFT");
        return super._grantRole(role, account);
    }

    function _revokeRole(bytes32 role, address account)
        internal
        virtual
        override
        returns (bool)
    {
        require(role != DEFAULT_ADMIN_ROLE, "Admin role is managed by NFT");
        return super._revokeRole(role, account);
    }
}