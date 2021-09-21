// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";

import "../amm/libraries/Math.sol";

/// @notice Attribution to delta.financial
/// @notice Attribution to dutchswap.com
/// @notice Attribution to sushiswap: https://github.com/sushiswap/miso/blob/master/contracts/Auctions/DutchAuction.sol

contract DutchAuction is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    Multicall
{
    /// @notice Main market variables.
    struct MarketInfo {
        uint64 startTime;
        uint64 endTime;
        uint128 totalTokens;
    }
    MarketInfo public marketInfo;

    /// @notice Market price variables.
    struct MarketPrice {
        uint128 startPrice;
        uint128 minimumPrice;
    }
    MarketPrice public marketPrice;

    /// @notice Market dynamic variables.
    struct MarketStatus {
        uint128 commitmentsTotal;
        bool finalized;
    }

    MarketStatus public marketStatus;

    /// @notice The token being sold.
    IERC20 public auctionToken;
    /// @notice The currency the auction accepts for payment. Can be ETH or token address.
    address public constant paymentCurrency = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice The commited amount of accounts.
    mapping(address => uint256) public commitments;
    /// @notice Amount of tokens to claim per address.
    mapping(address => uint256) public claimed;

    /// @notice Event for updating auction times.  Needs to be before auction starts.
    event AuctionTimeUpdated(uint256 startTime, uint256 endTime);
    /// @notice Event for updating auction prices. Needs to be before auction starts.
    event AuctionPriceUpdated(uint256 startPrice, uint256 minimumPrice);

    /// @notice Event for adding a commitment.
    event AddedCommitment(address addr, uint256 commitment);
    /// @notice Event for finalization of the auction.
    event AuctionFinalized();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer() {}

    /**
     * @notice Initializes main contract variables and transfers funds for the auction.
     * @dev Init function.
     * @param _token Address of the token being sold.
     * @param _startTime Auction start time.
     * @param _endTime Auction end time.
     * @param _startPrice Starting price of the auction.
     * @param _minimumPrice The minimum auction price.
     */
    function initialize(
        IERC20 _token,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _startPrice,
        uint256 _minimumPrice
    )
    external initializer
    {
        __Ownable_init();
        __ReentrancyGuard_init();

        require(IERC20Metadata(address(_token)).decimals() == 18, "DutchAuction: Token does not have 18 decimals");
        require(_startTime < 10000000000, "DutchAuction: enter an unix timestamp in seconds, not miliseconds");
        require(_endTime < 10000000000, "DutchAuction: enter an unix timestamp in seconds, not miliseconds");
        require(_startTime >= block.timestamp, "DutchAuction: start time is before current time");
        require(_endTime > _startTime, "DutchAuction: end time must be older than start price");
        require(_startPrice > _minimumPrice, "DutchAuction: start price must be higher than minimum price");
        require(_minimumPrice > 0, "DutchAuction: minimum price must be greater than 0");

        uint256 _totalTokens = _token.balanceOf(address(this));
        require(_totalTokens > 0,"DutchAuction: total tokens must be greater than zero");

        marketInfo.startTime     = SafeCast.toUint64(_startTime);
        marketInfo.endTime       = SafeCast.toUint64(_endTime);
        marketInfo.totalTokens   = SafeCast.toUint128(_totalTokens);
        marketPrice.startPrice   = SafeCast.toUint128(_startPrice);
        marketPrice.minimumPrice = SafeCast.toUint128(_minimumPrice);

        auctionToken = _token;
    }



    /**
     Dutch Auction Price Function
     ============================

     Start Price -----
                      \
                       \
                        \
                         \ ------------ Clearing Price
                        / \            = AmountRaised/TokenSupply
         Token Price  --   \
                     /      \
                   --        ----------- Minimum Price
     Amount raised /          End Time
    */

    /**
     * @notice Calculates the average price of each token from all commitments.
     * @return Average token price.
     */
    function tokenPrice() public view returns (uint256) {
        return uint256(marketStatus.commitmentsTotal) * 1e18 / uint256(marketInfo.totalTokens); // Muldiv
    }

    /**
     * @notice Returns auction price in any time.
     * @return Fixed start price or minimum price if outside of auction time, otherwise calculated current price.
     */
    function priceFunction() public view returns (uint256) {
        /// @dev Return Auction Price
        if (block.timestamp <= uint256(marketInfo.startTime)) {
            return uint256(marketPrice.startPrice);
        } else if (block.timestamp >= uint256(marketInfo.endTime)) {
            return uint256(marketPrice.minimumPrice);
        } else {
            return _currentPrice();
        }
    }

    /**
     * @notice The current clearing price of the Dutch auction.
     * @return The bigger from tokenPrice and priceFunction.
     */
    function clearingPrice() public view returns (uint256) {
        return Math.max(tokenPrice(), priceFunction());
    }


    ///--------------------------------------------------------
    /// Commit to buying tokens!
    ///--------------------------------------------------------

    receive() external payable {
        commitEth(payable(msg.sender));
    }

    /**
     * @notice Checks the amount of ETH to commit and adds the commitment. Refunds the buyer if commit is too high.
     * @param _beneficiary Auction participant ETH address.
     */
    function commitEth(address payable _beneficiary)
        public payable
    {
        // Get ETH able to be committed
        uint256 ethToTransfer = calculateCommitment(msg.value);

        /// @notice Accept ETH Payments.
        uint256 ethToRefund = msg.value - ethToTransfer;
        if (ethToTransfer > 0) {
            _addCommitment(_beneficiary, ethToTransfer);
        }
        /// @notice Return any ETH to be refunded.
        if (ethToRefund > 0) {
            _beneficiary.transfer(ethToRefund);
        }

        /// @notice Revert if commitmentsTotal exceeds the balance
        require(marketStatus.commitmentsTotal <= address(this).balance, "DutchAuction: The committed ETH exceeds the balance");
    }

    /**
     * @notice Calculates the pricedrop factor.
     * @return Value calculated from auction start and end price difference divided the auction duration.
     */
    function priceDrop() public view returns (uint256) {
        MarketInfo memory _marketInfo = marketInfo;
        MarketPrice memory _marketPrice = marketPrice;

        uint256 numerator = uint256(_marketPrice.startPrice - _marketPrice.minimumPrice);
        uint256 denominator = uint256(_marketInfo.endTime - _marketInfo.startTime);
        return numerator / denominator;
    }


   /**
     * @notice How many tokens the user is able to claim.
     * @param _user Auction participant address.
     * @return claimerCommitment User commitments reduced by already claimed tokens.
     */
    function tokensClaimable(address _user) public view returns (uint256 claimerCommitment) {
        if (commitments[_user] == 0) return 0;
        uint256 unclaimedTokens = IERC20(auctionToken).balanceOf(address(this));

        claimerCommitment = Math.min(
            commitments[_user] * uint256(marketInfo.totalTokens) / uint256(marketStatus.commitmentsTotal) - claimed[_user],
            unclaimedTokens
        );
    }

    /**
     * @notice Calculates total amount of tokens committed at current auction price.
     * @return Number of tokens commited.
     */
    function totalTokensCommitted() public view returns (uint256) {
        return uint256(marketStatus.commitmentsTotal) * 1e18 / clearingPrice();
    }

    /**
     * @notice Calculates the amout able to be committed during an auction.
     * @param _commitment Commitment user would like to make.
     * @return committed Amount allowed to commit.
     */
    function calculateCommitment(uint256 _commitment) public view returns (uint256 committed) {
        uint256 maxCommitment = uint256(marketInfo.totalTokens) * clearingPrice() / 1e18;
        if (uint256(marketStatus.commitmentsTotal) + _commitment > maxCommitment) {
            return maxCommitment - uint256(marketStatus.commitmentsTotal);
        }
        return _commitment;
    }

    /**
     * @notice Checks if the auction is open.
     * @return True if current time is greater than startTime and less than endTime.
     */
    function isOpen() public view returns (bool) {
        return block.timestamp >= uint256(marketInfo.startTime) && block.timestamp <= uint256(marketInfo.endTime);
    }

    /**
     * @notice Successful if tokens sold equals totalTokens.
     * @return True if tokenPrice is bigger or equal clearingPrice.
     */
    function auctionSuccessful() public view returns (bool) {
        return tokenPrice() >= clearingPrice();
    }

    /**
     * @notice Checks if the auction has ended.
     * @return True if auction is successful or time has ended.
     */
    function auctionEnded() public view returns (bool) {
        return auctionSuccessful() || block.timestamp > uint256(marketInfo.endTime);
    }

    /**
     * @return Returns true if market has been finalized
     */
    function finalized() public view returns (bool) {
        return marketStatus.finalized;
    }

    /**
     * @notice Calculates price during the auction.
     * @return Current auction price.
     */
    function _currentPrice() private view returns (uint256) {
        uint256 priceDiff = (block.timestamp - uint256(marketInfo.startTime)) * priceDrop();
        return uint256(marketPrice.startPrice) - priceDiff;
    }

    /**
     * @notice Updates commitment for this address and total commitment of the auction.
     * @param _addr Bidders address.
     * @param _commitment The amount to commit.
     */
    function _addCommitment(address _addr, uint256 _commitment) internal {
        require(block.timestamp >= uint256(marketInfo.startTime) && block.timestamp <= uint256(marketInfo.endTime), "DutchAuction: outside auction hours");
        MarketStatus storage status = marketStatus;

        uint256 newCommitment = commitments[_addr] + _commitment;

        commitments[_addr] = newCommitment;
        status.commitmentsTotal = SafeCast.toUint128(uint256(status.commitmentsTotal) + _commitment);
        emit AddedCommitment(_addr, _commitment);
    }


    //--------------------------------------------------------
    // Finalize Auction
    //--------------------------------------------------------

    /**
     * @notice Auction finishes successfully above the reserve.
     * @dev Transfer contract funds to initialized wallet.
     */
    function finalize() public onlyOwner() nonReentrant() {
        MarketStatus storage status = marketStatus;

        require(!status.finalized, "DutchAuction: auction already finalized");
        if (auctionSuccessful()) {
            /// @dev Successful auction
            /// @dev Transfer contributed tokens to wallet.
            Address.sendValue(payable(owner()), uint256(status.commitmentsTotal));
        } else {
            /// @dev Failed auction
            /// @dev Return auction tokens back to wallet.
            require(block.timestamp > uint256(marketInfo.endTime), "DutchAuction: auction has not finished yet");
            SafeERC20.safeTransfer(auctionToken, owner(), uint256(marketInfo.totalTokens));
        }
        status.finalized = true;
        emit AuctionFinalized();
    }


    /// @notice Withdraws bought tokens, or returns commitment if the sale is unsuccessful.
    function withdrawTokens() public {
        withdrawTokens(payable(msg.sender));
    }

   /**
     * @notice Withdraws bought tokens, or returns commitment if the sale is unsuccessful.
     * @dev Withdraw tokens only after auction ends.
     * @param beneficiary Whose tokens will be withdrawn.
     */
    function withdrawTokens(address payable beneficiary) public nonReentrant() {
        if (auctionSuccessful()) {
            require(marketStatus.finalized, "DutchAuction: not finalized");
            /// @dev Successful auction! Transfer claimed tokens.
            uint256 tokensToClaim = tokensClaimable(beneficiary);
            require(tokensToClaim > 0, "DutchAuction: No tokens to claim");
            claimed[beneficiary] = claimed[beneficiary] + tokensToClaim;
            SafeERC20.safeTransfer(auctionToken, beneficiary, tokensToClaim);
        } else {
            /// @dev Auction did not meet reserve price.
            /// @dev Return committed funds back to user.
            require(block.timestamp > uint256(marketInfo.endTime), "DutchAuction: auction has not finished yet");
            uint256 fundsCommitted = commitments[beneficiary];
            commitments[beneficiary] = 0; // Stop multiple withdrawals and free some gas
            Address.sendValue(beneficiary, fundsCommitted);
        }
    }

    function getBaseInformation() external view returns(address, uint64, uint64, bool) {
        return (address(auctionToken), marketInfo.startTime, marketInfo.endTime, marketStatus.finalized);
    }

    function getTotalTokens() external view returns(uint256) {
        return uint256(marketInfo.totalTokens);
    }
}
