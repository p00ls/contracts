// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IP00lsSettings.sol";

contract P00lsSettings01 is IP00lsSettings, Ownable
{
    address public override token;
    uint256 public override delay;
    uint256 public override minForSwap;

    event TokenUpdated(address oldToken, address newToken);
    event DelayUpdated(uint256 oldDelay, uint256 newDelay);
    event MinForSwapUpdated(uint256 oldMinForSwap, uint256 newMinForSwap);

    constructor(address _admin)
    {
        transferOwnership(_admin);
    }

    function setToken(address _token) external virtual override
    {
        emit TokenUpdated(token, _token);
        token = _token;
    }

    function setDelay(uint256 _delay) external virtual override
    {
        emit DelayUpdated(delay, _delay);
        delay = _delay;
    }

    function setMinForSwap(uint256 _minForSwap) external virtual override
    {
        emit MinForSwapUpdated(minForSwap, _minForSwap);
        minForSwap = _minForSwap;
    }

    function isSwapAuthorized(address account) external view virtual override returns (bool)
    {
        return IERC20(token).balanceOf(account) >= minForSwap;
    }
}
