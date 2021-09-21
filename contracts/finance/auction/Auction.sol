// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@openzeppelin/contracts/utils/Timers.sol";

contract Auction is ERC20PermitUpgradeable, OwnableUpgradeable, Multicall {
    using Timers for Timers.Timestamp;

    address public immutable auctionManager;

    IERC20 public auctionToken;
    Timers.Timestamp private _deadline;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {
        auctionManager = msg.sender;
    }

    function initialize(IERC20 token, uint64 deadline) external initializer {
        __Ownable_init();
        __ERC20_init("P00ls Auction Token", "P00ls-Auction");
        __ERC20Permit_init("P00ls Auction Token");

        auctionToken = token;
        _deadline.setDeadline(deadline);
    }

    receive() external payable {
        commit(msg.sender);
    }

    function commit(address to) public payable {
        require(_deadline.isPending());
        _mint(to, msg.value);
    }

    function withdraw(address payable to) public {
        uint256 value = balanceOf(to);

        if (_deadline.isExpired()) {
            uint256 balance = ethToAuctionned(value);
            _burn(to, value);
            SafeERC20.safeTransfer(auctionToken, to, balance);
        } else {
            _burn(to, value);
            Address.sendValue(to, value);
        }
    }

    function finalize(address payable to) public onlyOwner() {
        require(_deadline.isExpired(), "Auction: auction has not finished yet");
        Address.sendValue(to, address(this).balance);
    }

    function ethToAuctionned(uint256 amount) public view returns (uint256) {
        return amount * auctionToken.balanceOf(address(this)) / totalSupply();
    }

    function auctionnedToEth(uint256 amount) public view returns (uint256) {
        return amount * totalSupply() / auctionToken.balanceOf(address(this));
    }
}