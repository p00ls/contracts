// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@amxx/hre/contracts/ENSReverseRegistration.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "../amm/libraries/UniswapV2Library.sol";
import "../../env/IWETH.sol";

/// @custom:security-contact security@p00ls.com
contract FeeRedistributor is AccessControl, Multicall {
    bytes32 public constant REDISTRIBUTION_MANAGER_ROLE = keccak256("REDISTRIBUTION_MANAGER_ROLE");

    IUniswapV2Router02 public immutable router;
    IUniswapV2Factory  public immutable factory;
    IWETH              public immutable WETH;
    IERC20             public immutable p00ls;
    address            public           recipient;

    event FeesToOwner(address indexed owner, uint256 amount);
    event FeesToRecipient(address indexed recipient, uint256 amount);
    event FeesLiquidated(address indexed token, uint256 liquidity, uint256 amount);

    constructor(address _admin, IUniswapV2Router02 _router, IERC20 _p00ls, address _recipient)
    {
        _setupRole(DEFAULT_ADMIN_ROLE,          _admin);
        _setupRole(REDISTRIBUTION_MANAGER_ROLE, _admin);
        router    = _router;
        factory   = IUniswapV2Factory(_router.factory());
        WETH      = IWETH(_router.WETH());
        p00ls     = _p00ls;
        recipient = _recipient; // by default this should be the xP00ls
    }

    // token is crea or weth
    function redistributedFees(IERC20 token)
        external
        onlyRole(REDISTRIBUTION_MANAGER_ROLE)
    {
        uint256 profit = _liquidateAllLP(token);

        // WETH has no owner, creator tokens do.
        try Ownable(address(token)).owner() returns (address owner) {
            if (owner != address(0)) { // just to be safe
                SafeERC20.safeTransfer(p00ls, owner, profit / 2);
                emit FeesToOwner(owner, profit / 2);
            }
        } catch {}

        // there might me more because of a transfer, we send it to the recipient
        uint256 amount = p00ls.balanceOf(address(this));
        SafeERC20.safeTransfer(p00ls, recipient, amount);
        emit FeesToRecipient(recipient, amount);
    }

    function _liquidateAllLP(IERC20 token) private returns (uint256) {
        // find pair
        IERC20 pair = IERC20(UniswapV2Library.pairFor(address(factory), address(p00ls), address(token)));

        // liquidate all lps
        uint256 liquidity  = pair.balanceOf(address(this));
        SafeERC20.safeApprove(pair, address(router), liquidity);
        (uint256 amountToken, uint256 amountP00ls) = router.removeLiquidity(address(token), address(p00ls), liquidity, 0, 0, address(this), block.timestamp);

        // Swap tokens from token to p00ls
        SafeERC20.safeApprove(token, address(router), amountToken);
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = address(p00ls);
        uint256[] memory amounts = router.swapExactTokensForTokens(amountToken, 0, path, address(this), block.timestamp);
        amountP00ls += amounts[0];

        emit FeesLiquidated(address(token), liquidity, amountP00ls);

        return amountP00ls;
    }

    function setName(address ensregistry, string calldata ensname)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        ENSReverseRegistration.setName(ensregistry, ensname);
    }
}
