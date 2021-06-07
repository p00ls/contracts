// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IP00lsSettings
{
    function token()      external view returns (address);
    function delay()      external view returns (uint256);
    function minForSwap() external view returns (uint256);

    function setDelay     (uint256) external;
    function setToken     (address) external;
    function setMinForSwap(uint256) external;

    function isSwapAuthorized(address) external view returns (bool);
}
