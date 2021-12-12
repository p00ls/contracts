// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../tokens/extensions/IERC1363.sol";

contract ERC1363ReceiverMock is IERC1363Receiver, IERC1363Spender {
    event TransferReceived(address operator, address from, uint256 value, bytes data);
    event ApprovalReceived(address owner, uint256 value, bytes data);

    function onTransferReceived(
        address operator,
        address from,
        uint256 value,
        bytes memory data
    ) external override returns (bytes4) {
        if (data.length == 1) {
            require(data[0] == 0x00, "onTransferReceived revert");
        }
        emit TransferReceived(operator, from, value, data);
        return this.onTransferReceived.selector;
    }

    function onApprovalReceived(
        address owner,
        uint256 value,
        bytes memory data
    ) external override returns (bytes4) {
        if (data.length == 1) {
            require(data[0] == 0x00, "onApprovalReceived revert");
        }
        emit ApprovalReceived(owner, value, data);
        return this.onApprovalReceived.selector;
    }
}