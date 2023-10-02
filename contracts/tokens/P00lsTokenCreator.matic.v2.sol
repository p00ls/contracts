// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./P00lsTokenCreator.matic.sol";

/// @custom:security-contact security@p00ls.com
contract P00lsTokenCreator_Polygon_V2 is P00lsTokenCreator_Polygon
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address registry) P00lsTokenCreator_Polygon(registry) {}

    // Change the access management from onlyOwner to onlyAdmin
    function hasRole(bytes32 role, address account)
        public
        view
        virtual
        override
        returns (bool)
    {
        return role == DEFAULT_ADMIN_ROLE ? account == admin() : super.hasRole(role, account);
    }

    // Change the access management from onlyOwner to onlyAdmin
    function open() public virtual override onlyAdmin() {
        isOpen = true;
        emit Opened();
    }
}
