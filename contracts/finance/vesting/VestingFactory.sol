// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/utils/IVotes.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/finance/VestingWalletUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/MulticallUpgradeable.sol";

/// @custom:security-contact security@p00ls.com
contract VestingTemplate is
    VestingWalletUpgradeable,
    OwnableUpgradeable,
    MulticallUpgradeable
{
    constructor() initializer() {}

    function initialize(
        address beneficiaryAddress,
        uint64 startTimestamp,
        uint64 durationSeconds
    )
        external
        initializer()
    {
        __VestingWallet_init(address(1), startTimestamp, durationSeconds);
        _transferOwnership(beneficiaryAddress);
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

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";

/// @custom:security-contact security@p00ls.com
contract VestingFactory is
    Multicall
{
    address public immutable template = address(new VestingTemplate());

    event NewInstance(address instance);

    function createWallet(
        address beneficiaryAddress,
        uint64 startTimestamp,
        uint64 durationSeconds
    )
        external
        returns (address)
    {
        address instance = Clones.clone(template);
        VestingTemplate(payable(instance)).initialize(beneficiaryAddress, startTimestamp, durationSeconds);
        emit NewInstance(instance);
        return instance;
    }

}