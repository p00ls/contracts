// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@maticnetwork/fx-portal/contracts/tunnel/FxBaseRootTunnel.sol";
import "../../tokens/interfaces.sol";
import "../../utils/convert.sol";

enum BRIDGE_OP {
    DEPLOY,
    DEPOSIT
}

function encodeDeposit(address rootToken, address to, uint256 amount) pure returns (bytes memory) {
    return abi.encode(BRIDGE_OP.DEPOSIT, abi.encode(rootToken, to, amount));
}

function decodeDepositData(bytes memory data) pure returns (address, address, uint256) {
    return abi.decode(data, (address, address, uint256));
}

function encodeDeploy(address rootToken, string memory name, string memory symbol, string memory xname, string memory xsymbol) pure returns (bytes memory) {
    return abi.encode(BRIDGE_OP.DEPLOY, abi.encode(rootToken, name, symbol, xname, xsymbol));
}

function decodeDeployData(bytes memory data) pure returns (address, string memory, string memory, string memory, string memory) {
    return abi.decode(data, (address, string, string, string, string));
}

/// @custom:security-contact security@p00ls.com
contract P00lsBridgePolygon is FxBaseRootTunnel, IERC1363Receiver {
    IERC721 public immutable registry;

    constructor(address _checkpointManager, address _fxRoot, IERC721 _registry)
        FxBaseRootTunnel(_checkpointManager, _fxRoot)
    {
        registry = _registry;
    }

    modifier onlyValidToken(address token) {
        require(registry.ownerOf(addressToUint256(token)) != address(0), "P00lsBridgePolygon: invalid token");
        _;
    }

    function deploy(IP00lsTokenCreator rootToken)
        external
        onlyValidToken(address(rootToken))
    {
        IERC20Metadata xRootToken = rootToken.xCreatorToken();

        bytes memory data = abi.encode(
            rootToken,
            rootToken.name(),
            rootToken.symbol(),
            xRootToken.name(),
            xRootToken.symbol()
        );
        _sendMessageToChild(abi.encode(BRIDGE_OP.DEPLOY, data));
    }

    function bridge(IERC20 rootToken, address to, uint256 amount)
        external
        onlyValidToken(address(rootToken))
    {
        require(to != address(0), "P00lsBridgePolygon: invalid receiver");
        SafeERC20.safeTransferFrom(rootToken, msg.sender, address(this), amount);
        _sendMessageToChild(encodeDeposit(address(rootToken), to, amount));
    }

    function onTransferReceived(address, address, uint256 value, bytes calldata data)
        external
        onlyValidToken(msg.sender)
        returns (bytes4)
    {
        address to = abi.decode(data, (address));
        require(to != address(0), "P00lsBridgePolygon: invalid receiver");
        _sendMessageToChild(encodeDeposit(msg.sender, to, value));
        return this.onTransferReceived.selector;
    }

    function _processMessageFromChild(bytes memory message)
        internal
        override
    {
        (address rootToken, address to, uint256 amount) = abi.decode(message, (address, address, uint256));
        SafeERC20.safeTransfer(IERC20(rootToken), to, amount);
    }
}