// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import "../utils/RegistryOwnable.sol";
import "./P00lsTokenBase.sol";
import "./interfaces.sol";

/// @custom:security-contact security@p00ls.com
contract P00lsTokenCreator_Polygon is P00lsTokenBase, RegistryOwnable
{
    IP00lsTokenXCreator public xCreatorToken;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address registry)
        RegistryOwnable(registry)
        initializer()
    {}

    function initialize(string calldata name, string calldata symbol, address child)
        external
        initializer()
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        xCreatorToken = IP00lsTokenXCreator(child);
    }

    function mint(address user, uint256 amount) external {
        require(msg.sender == address(ownershipRegistry));
        _mint(user, amount);
    }

    function withdraw(address to, uint256 amount) external {
        _burn(msg.sender, amount);
        IP00lsCreatorRegistry_Polygon(address(ownershipRegistry)).__withdraw(to, amount);
    }

    function withdrawFrom(address from, address to, uint256 amount) external {
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
        IP00lsCreatorRegistry_Polygon(address(ownershipRegistry)).__withdraw(to, amount);
    }

    function owner()
        public
        view
        override(P00lsTokenBase, RegistryOwnable)
        returns (address)
    {
        return super.owner();
    }

    /**
     * xCreatorToken bindings
     */
    function _delegate(address delegator, address delegatee)
        internal
        override
    {
        super._delegate(delegator, delegatee);
        xCreatorToken.__delegate(delegator, delegatee);
    }

    function allowance(address holder, address spender)
        public
        view
        override
        returns (uint256)
    {
        return spender == address(xCreatorToken)
            ? type(uint256).max
            : super.allowance(holder, spender);
    }
}
