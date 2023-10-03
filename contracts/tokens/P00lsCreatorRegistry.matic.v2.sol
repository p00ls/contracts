// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./P00lsRegistryBase.v2.sol";
import "./P00lsCreatorRegistry.matic.sol";

/// @custom:security-contact security@p00ls.com
contract P00lsCreatorRegistry_Polygon_V2 is P00lsRegistryBaseV2, P00lsCreatorRegistry_Polygon
{
    bytes32 public constant BRIDGER_ROLE = keccak256("BRIDGER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _fxChild) P00lsCreatorRegistry_Polygon(_fxChild) {}

    function forceBridgeToken(
        address holder,
        address rootToken,
        string calldata name,
        string calldata symbol,
        string calldata xname,
        string calldata xsymbol,
        address recipient,
        uint256 liquidity
    )
        external
        onlyRole(BRIDGER_ROLE)
    {
        // deploy and initialize bridged tokens
        address creator = deployAndInitialize(holder, rootToken, name, symbol, xname, xsymbol);

        // Mint liquidity. An equivalent amount should be deposited on the bridge
        P00lsTokenCreator_Polygon(creator).mint(recipient, liquidity);
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
