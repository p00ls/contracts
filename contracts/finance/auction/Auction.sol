// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@amxx/hre/contracts/FullMath.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@openzeppelin/contracts/utils/Timers.sol";
// import "../../utils/Timers.sol";

contract Auction is ERC20PermitUpgradeable, OwnableUpgradeable, Multicall {
    using Timers for uint64;
    using Timers for Timers.Timestamp;

    address public immutable auctionManager;

    IERC20           public token;
    Timers.Timestamp public start;
    Timers.Timestamp public deadline;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor()
        initializer
    {
        auctionManager = msg.sender;
    }

    function initialize(IERC20Metadata _token, uint64 _start, uint64 _deadline)
        external
        initializer
    {
        string memory _name   = string(abi.encodePacked("P00ls Auction Token - ", _token.name()));
        string memory _symbol = string(abi.encodePacked("P00lsAuction-",         _token.symbol()));

        __Ownable_init();
        __ERC20_init(_name, _symbol);
        __ERC20Permit_init(_name);

        token    = _token;
        // start    = _start.toTimestamp();
        // deadline = _deadline.toTimestamp();
        start.setDeadline(_start);
        deadline.setDeadline(_deadline);
    }

    receive()
        external
        payable
    {
        commit(msg.sender);
    }

    function commit(address to)
        public
        payable
    {
        require(start.isExpired() && deadline.isPending(), "Auction: auction not active");
        _mint(to, msg.value);
    }

    function leave(address payable to)
        public
    {
        require(start.isExpired() && deadline.isPending(), "Auction: auction not active");
        uint256 value = balanceOf(msg.sender);
        _burn(msg.sender, value);
        Address.sendValue(to, FullMath.mulDiv(80, 100, value)); // 20% penalty
    }

    function withdraw(address to)
        public
    {
        require(deadline.isExpired(), "Auction: auction not finished");
        uint256 value = balanceOf(msg.sender);
        uint256 amount = ethToAuctionned(value); // must be computed BEFORE the _burn operation
        _burn(msg.sender, value);
        SafeERC20.safeTransfer(token, to, amount);
    }

    function finalize(address payable to)
        public
        onlyOwner()
    {
        require(deadline.isExpired(), "Auction: auction not finished");
        Address.sendValue(to, address(this).balance);
    }

    function ethToAuctionned(uint256 amount)
       public
       view
       returns (uint256)
    {
        return FullMath.mulDiv(amount, totalSupply(), token.balanceOf(address(this)));
    }

    function auctionnedToEth(uint256 amount)
        public
        view
        returns (uint256)
    {
        return FullMath.mulDiv(amount, token.balanceOf(address(this)), totalSupply());
    }
}