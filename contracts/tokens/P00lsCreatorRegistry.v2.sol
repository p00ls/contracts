// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./P00lsCreatorRegistry.sol";

/// @custom:security-contact security@p00ls.com
contract P00lsCreatorRegistryV2 is P00lsCreatorRegistry {
    function createToken2(
        address owner,
        string calldata name,
        string calldata symbol,
        string calldata xname,
        string calldata xsymbol,
        bytes32 root,
        bytes32 salt
    )
        external
        onlyRole(REGISTRY_MANAGER_ROLE)
        returns (address)
    {
        address creator  = _createProxy(beaconCreator(), salt);
        address xCreator = _createProxy(beaconXCreator(), salt);

        _mint(owner, addressToUint256(creator));

        P00lsTokenCreator(creator).initialize(
            name,
            symbol,
            root,
            xCreator
        );
        P00lsTokenXCreator(xCreator).initialize(
            xname,
            xsymbol,
            creator
        );

        return creator;
    }

    function predictToken2(bytes32 salt) external view returns (address) {
        return _predictProxy(beaconCreator(), salt);
    }
}
