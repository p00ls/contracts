// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./P00lsRegistryBase.v2.sol";
import "./P00lsCreatorRegistry.sol";

/// @custom:security-contact security@p00ls.com
contract P00lsCreatorRegistry_V2 is P00lsRegistryBaseV2, P00lsCreatorRegistry {
    function createToken2(
        address owner,
        string calldata name,
        string calldata symbol,
        string calldata xname,
        string calldata xsymbol,
        bytes32 root
    )
        external
        onlyRole(REGISTRY_MANAGER_ROLE)
        returns (address)
    {
        bytes32 salt     = keccak256(abi.encodePacked(name, symbol, xname, xsymbol, root));
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

    function predictToken2(
        string calldata name,
        string calldata symbol,
        string calldata xname,
        string calldata xsymbol,
        bytes32 root
    ) external view returns (address) {
        return _predictProxy(
            beaconCreator(),
            keccak256(abi.encodePacked(name, symbol, xname, xsymbol, root))
        );
    }

    // Resolve
    function _isApprovedOrOwner(address spender, uint256 tokenId)
        internal
        view
        virtual
        override(P00lsRegistryBase, P00lsRegistryBaseV2)
        returns (bool)
    {
        return super._isApprovedOrOwner(spender, tokenId);
    }
}
