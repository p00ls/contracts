// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IERC20Factory {
    function createStandardL2Token(address _remoteToken, string calldata _name, string calldata _symbol) external returns (address);
    function createOptimismMintableERC20(address _remoteToken, string calldata _name, string calldata _symbol) external returns (address);
    function createOptimismMintableERC20WithDecimals(address _remoteToken, string calldata _name, string calldata _symbol, uint8 _decimals) external returns (address);
}

/// @custom:security-contact security@p00ls.com
contract BaseFactoryRelay is AccessControl {
    // https://basescan.org/address/0xF10122D428B4bc8A9d050D06a2037259b4c4B83B
    IERC20Factory public constant factory      = IERC20Factory(0xF10122D428B4bc8A9d050D06a2037259b4c4B83B);
    bytes32       public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    event NewToken(address indexed remote, address local);

    constructor(address _admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    function createOptimismMintableERC20(address _remoteToken, string calldata _name, string calldata _symbol) external onlyRole(RELAYER_ROLE) returns (address) {
        address localToken = factory.createOptimismMintableERC20(_remoteToken, _name, _symbol);
        emit NewToken(_remoteToken, localToken);
        return localToken;
    }

    function createOptimismMintableERC20WithDecimals(address _remoteToken, string calldata _name, string calldata _symbol, uint8 _decimals) external onlyRole(RELAYER_ROLE) returns (address) {
        address localToken = factory.createOptimismMintableERC20WithDecimals(_remoteToken, _name, _symbol, _decimals);
        emit NewToken(_remoteToken, localToken);
        return localToken;
    }
}
