// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "./IERC1046.sol";

abstract contract ERC1046Upgradeable is IERC1046, ERC20Upgradeable {
    string public override tokenURI;

    function _setTokenURI(string calldata _tokenURI) internal {
        tokenURI = _tokenURI;
    }
}
