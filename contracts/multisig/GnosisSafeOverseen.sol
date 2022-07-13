// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";

contract GnosisSafeOverseen is GnosisSafe, Multicall
{
    address public overseer;

    event OverseerChanged(address overseer);
    event OverseerSelfExecution();

    function setManager(address newOverseer) external {
        require(msg.sender == (overseer == address(0) ? address(this) : overseer), "Unauthorized access");
        overseer = newOverseer;
        emit OverseerChanged(newOverseer);
    }

    function overseerSelfExecute(bytes calldata data) external {
        require(msg.sender == overseer, "Unauthorized access");
        Address.functionCall(address(this), data);
        emit OverseerSelfExecution();
    }
}
