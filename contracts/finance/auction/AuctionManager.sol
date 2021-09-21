// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

import "../amm/UniswapV2Router02.sol";
import "./Auction.sol";

contract AuctionManager is AccessControl {
    address public immutable template = address(new Auction());
    bytes32 public constant  AUCTION_MANAGER_ROLE = keccak256("AUCTION_MANAGER_ROLE");

    UniswapV2Router02 public immutable router;

    uint8 private _openPayments;

    event AuctionCreated(address indexed token, address auction);

    modifier withPayments() {
        _openPayments = 2;
        _;
        _openPayments = 1;
    }

    constructor(address admin, address routerAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin);

        router = UniswapV2Router02(payable(routerAddress));
    }

    receive() external payable {
        require(_openPayments == 2);
    }

    function start(IERC20 token) external onlyRole(AUCTION_MANAGER_ROLE) returns (address) {
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0);

        address instance = Clones.cloneDeterministic(template, bytes32(bytes20(address(token))));

        emit AuctionCreated(address(token), instance);

        // Send half of the token to the instance - keep the rest for the AMM
        SafeERC20.safeTransfer(token, instance, balance / 2);

        // Start auction
        Auction(payable(instance)).initialize(token, uint64(block.timestamp + 14 days));

        return instance;
    }

    function finalize(IERC20 token) external onlyRole(AUCTION_MANAGER_ROLE) withPayments() {
        address instance = getAuctionInstance(token);
        Auction(payable(instance)).finalize(payable(this));

        uint256 balance = token.balanceOf(address(this));
        uint256 value   = address(this).balance;
        address weth    = router.WETH();
        address factory = router.factory();

        // create AMM pair if needed
        if (UniswapV2Factory(factory).getPair(weth, address(token)) == address(0)) {
            UniswapV2Factory(factory).createPair(weth, address(token));
        }

        // provide liquidity
        SafeERC20.safeApprove(token, address(router), balance);
        router.addLiquidityETH{value: value}(address(token), balance, 0, 0, address(this), block.timestamp);
    }

    function getAuctionInstance(IERC20 token) public view returns (address) {
        address instance = Clones.predictDeterministicAddress(template, bytes32(bytes20(address(token))));
        require(Address.isContract(instance), "No auction for this token");
        return instance;
    }
}
