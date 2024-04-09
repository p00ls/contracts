// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-v4/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts-v4/utils/Address.sol";
import "./IWETH.sol";

contract WETH is IWETH, ERC20Permit {
    constructor()
    ERC20("Wrapped Ether", "WETH")
    ERC20Permit("Wrapped Ether")
    {
    }

    receive() external payable {
        _mint(msg.sender, msg.value);
    }

    function deposit() external override payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 value) external override {
        _burn(msg.sender, value);
        Address.sendValue(payable(msg.sender), value);
    }
}
