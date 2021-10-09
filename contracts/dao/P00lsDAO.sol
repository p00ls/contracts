// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorTimelockControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract P00lsDAO is
    Initializable,
    GovernorUpgradeable,
    GovernorCountingSimpleUpgradeable,
    GovernorVotesUpgradeable,
    GovernorTimelockControlUpgradeable
{
    uint256 private _votingDelay;
    uint256 private _votingPeriod;
    uint256 private _quorum;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(ERC20VotesUpgradeable _token, TimelockControllerUpgradeable _timelock)
        public initializer()
    {
        __Governor_init("p00lsDAO");
        __GovernorCountingSimple_init();
        __GovernorVotes_init(_token);
        __GovernorTimelockControl_init(_timelock);

        _votingDelay  = 1;
        _votingPeriod = 45818;
        _quorum       = 1;
    }

    function setVotingDelay (uint256 newVotingDelay ) public onlyGovernance() { _votingDelay  = newVotingDelay;  }
    function setVotingPeriod(uint256 newVotingPeriod) public onlyGovernance() { _votingPeriod = newVotingPeriod; }
    function setQuorum      (uint256 newQuorum      ) public onlyGovernance() { _quorum       = newQuorum;       }
    function votingDelay    (                       ) public view override returns (uint256) { return _votingDelay;  }
    function votingPeriod   (                       ) public view override returns (uint256) { return _votingPeriod; }
    function quorum         (uint256                ) public view override returns (uint256) { return _quorum;       }

    // The following functions are overrides required by Solidity.

    function getVotes(address account, uint256 blockNumber)
        public
        view
        override(IGovernorUpgradeable, GovernorVotesUpgradeable)
        returns (uint256)
    {
        return super.getVotes(account, blockNumber);
    }

    function state(uint256 proposalId)
        public
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function propose(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description)
        public
        override(GovernorUpgradeable, IGovernorUpgradeable)
        returns (uint256)
    {
        return super.propose(targets, values, calldatas, description);
    }

    function _execute(uint256 proposalId, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
    {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash)
        internal
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (uint256)
    {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (address)
    {
        return super._executor();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(GovernorUpgradeable, GovernorTimelockControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
