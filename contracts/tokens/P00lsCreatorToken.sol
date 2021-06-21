// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../utils/RegistryOwnableUpgradeable.sol";
import "../utils/BitMap.sol";
import "../utils/ENSReverseRegistration.sol";
import "./extensions/ERC1046Upgradeable.sol";
import "./extensions/ERC1363Upgradeable.sol";

// TODO: use onlyOwner to perform admin operations
contract P00lsCreatorToken is
    ERC20PermitUpgradeable,
    ERC1046Upgradeable,
    ERC1363Upgradeable,
    RegistryOwnableUpgradeable
{
    using BitMap for BitMap.BitMap;

    bytes32 public merkleRoot;
    BitMap.BitMap private claimedBitMap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor()
    initializer
    {}

    function initialize(string calldata name, string calldata symbol, bytes32 root)
    external initializer
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        __RegistryOwnable_init(msg.sender);
        merkleRoot = root;
    }

    function isClaimed(uint256 index)
    external view returns (bool)
    {
        return claimedBitMap.isSet(index);
    }

    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof)
    external
    {
        require(!claimedBitMap.isSet(index), "P00lsCreatorToken::claim: drop already claimed");

        require(MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encodePacked(index, account, amount))), "P00lsCreatorToken::claim: invalid merkle proof");

        claimedBitMap.set(index);
        _mint(account, amount);
    }

    function setTokenURI(string calldata _tokenURI)
    external onlyOwner()
    {
        _setTokenURI(_tokenURI);
    }

    function setName(address ensregistry, string calldata ensname)
    external onlyOwner()
    {
        ENSReverseRegistration.setName(ensregistry, ensname);
    }
}
