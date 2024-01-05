// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@amxx/hre/contracts/ENSReverseRegistration.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC4906.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "./implementations/ERC6551Account.sol";
import "./interfaces/IERC6551Registry.sol";

contract GiftCardRegistry is
    Ownable,
    ERC721,
    Multicall,
    IERC4906
{
    event MintFeeUpdate(uint256 newFee);
    event BeneficiaryUpdate(address newBeneficiary);

    IERC6551Registry public constant registry = IERC6551Registry(0x000000006551c19487814612e58FE06813775758);
    ERC6551Account   public immutable implementation = new ERC6551Account();

    uint256 public  mintFee;
    address public  beneficiary;
    uint256 public  newTokenId;
    string  private _uriPrefix;

    constructor(string memory name_, string memory symbol_)
        ERC721(name_, symbol_)
    {
        beneficiary = msg.sender;
    }

    function mint(address to) public payable returns (address) {
        uint256 fee = mintFee; // cache value
        require(msg.value >= fee, "Invalid payment");

        // Mint token
        uint256 tokenId = newTokenId++;
        _safeMint(to, tokenId);

        // Create the account. This does not revert if the account already exists.
        address account = registry.createAccount(address(implementation), bytes32(0), block.chainid, address(this), tokenId);

        // Move funds: fee to the beneficiary, extra to the account
        Address.sendValue(payable(beneficiary), fee);
        if (msg.value > fee) {
            Address.sendValue(payable(account), msg.value - fee);
        }

        return account;
    }

    function getAccountForToken(uint256 tokenId) public view returns (address) {
        return registry.account(address(implementation), bytes32(0), block.chainid, address(this), tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return _uriPrefix;
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner() {
        emit BatchMetadataUpdate(0, type(uint256).max);
        _uriPrefix = newBaseURI;
    }

    function setBeneficiary(address newBeneficiary) external onlyOwner() {
        emit BeneficiaryUpdate(newBeneficiary);
        beneficiary = newBeneficiary;
    }

    function setMintFee(uint256 newFee) external onlyOwner() {
        emit MintFeeUpdate(newFee);
        mintFee = newFee;
    }

    function setName(address ensregistry, string calldata ensname) external onlyOwner() {
        ENSReverseRegistration.setName(ensregistry, ensname);
    }
}
