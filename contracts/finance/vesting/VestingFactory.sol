// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/utils/IVotes.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@openzeppelin/contracts-upgradeable/finance/VestingWalletUpgradeable.sol";
import "../../utils/RegistryOwnable.sol";

/// @custom:security-contact security@p00ls.com
contract VestingTemplate is
    RegistryOwnable,
    VestingWalletUpgradeable,
    Multicall
{
    constructor(address ownershipRegistry_) initializer()
    RegistryOwnable(ownershipRegistry_)
    {}

    function initialize(uint64 startTimestamp, uint64 durationSeconds)
        external
        initializer()
    {
        __VestingWallet_init(address(1), startTimestamp, durationSeconds);
    }

    function beneficiary()
        public
        view
        virtual
        override
        returns (address)
    {
        return owner();
    }

    function delegate(IVotes token, address delegatee)
        external
        onlyOwner()
    {
        token.delegate(delegatee);
    }
}

/// @custom:security-contact security@p00ls.com
contract VestingFactory is
    ERC721("Vestings", "Vestings"),
    Multicall
{
    address public immutable template = address(new VestingTemplate(address(this)));

    function createWallet(
        address beneficiaryAddress,
        uint64 startTimestamp,
        uint64 durationSeconds
    )
        external
        returns (address)
    {
        address instance = Clones.clone(template);
        VestingTemplate(payable(instance)).initialize(startTimestamp, durationSeconds);
        _mint(beneficiaryAddress, addressToUint256(instance));
        return instance;
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId)
        internal
        view
        override
        returns (bool)
    {
        return addressToUint256(spender) == tokenId || super._isApprovedOrOwner(spender, tokenId);
    }
}
