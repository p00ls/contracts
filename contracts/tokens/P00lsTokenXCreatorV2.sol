// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@amxx/hre/contracts/tokens/utils/Checkpoints.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../finance/staking/Escrow.sol";
import "./extensions/ERC4626Upgradeable.sol";
import "./P00lsTokenBase.sol";
import "./interfaces.sol";

/// @custom:security-contact security@p00ls.com
contract P00lsTokenXCreatorV2 is IEscrowReceiver, P00lsTokenBase, ERC4626Upgradeable
{
    using Checkpoints for Checkpoints.History;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    Escrow              public immutable stakingEscrow;
    Checkpoints.History internal         conversion;

    modifier onlyOwner() {
        require(owner() == msg.sender, "P00lsTokenXCreator: owner restricted");
        _;
    }

    modifier onlyParent() {
        require(asset() == msg.sender, "P00lsTokenXCreator: creator token restricted");
        _;
    }

    modifier accrue() {
        stakingEscrow.release(IERC20(asset()));
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address escrow)
        initializer()
    {
        stakingEscrow = Escrow(escrow);
    }

    function initialize(string calldata name, string calldata symbol, address parent)
        external
        initializer()
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        __ERC4626_init(IERC20MetadataUpgradeable(parent));

        // before escrow release, ratio is 1:1
        conversion.push(1 ether);
    }

    function creatorToken()
        public
        view
        returns (IP00lsTokenCreator)
    {
        return IP00lsTokenCreator(asset());
    }

    function owner()
        public
        view
        override
        returns (address)
    {
        return creatorToken().owner();
    }

    function onEscrowRelease(uint256)
        public
    {
        uint256 value = convertToAssets(1 ether);
        if (value != conversion.latest())
        {
            conversion.push(value);
        }
    }

    function convertToAssetsAtBlock(uint256 shares, uint256 blockNumber)
        public
        view
        returns (uint256)
    {
        return Math.mulDiv(shares, conversion.past(blockNumber), 1 ether);
    }

    /**
     * Delegation
     */
    function __delegate(address delegator, address delegatee)
        external
        onlyParent()
    {
        _delegate(delegator, delegatee);
    }

    function delegate(address)
        public
        pure
        override
    {
        revert("P00lsTokenXCreator: delegation is registered on the creatorToken");
    }

    function delegateBySig(address, uint256, uint256, uint8, bytes32, bytes32)
        public
        pure
        override
    {
        revert("P00lsTokenXCreator: delegation is registered on the creatorToken");
    }

    /**
     * Internal override resolution
     */
    function _mint(address account, uint256 amount)
        internal
        virtual override(P00lsTokenBase, ERC20Upgradeable)
    {
        super._mint(account, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        virtual override(P00lsTokenBase, ERC20Upgradeable)
    {
        super._burn(account, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        virtual override(P00lsTokenBase, ERC20Upgradeable)
    {
        super._afterTokenTransfer(from, to, amount);
    }
}
