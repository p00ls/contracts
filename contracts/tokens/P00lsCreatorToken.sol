// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import "@amxx/hre/contracts/ENSReverseRegistration.sol";
import "../utils/RegistryOwnable.sol";
import "./extensions/ERC1046Upgradeable.sol";
import "./extensions/ERC1363Upgradeable.sol";

// TODO: use onlyOwner & onlyAdmin to perform admin operations
contract P00lsCreatorToken is
    ERC20VotesUpgradeable,
    ERC1046Upgradeable,
    ERC1363Upgradeable,
    RegistryOwnable
{
    using BitMaps for BitMaps.BitMap;

    bytes32 private __merkleRoot;
    BitMaps.BitMap private __claimedBitMap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address registry)
    RegistryOwnable(registry)
    initializer
    {}

    function initialize(string calldata name, string calldata symbol, bytes32 root)
    external initializer
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        __merkleRoot = root;
    }

    function merkleRoot()
    external view returns (bytes32)
    {
        return __merkleRoot;
    }

    function isClaimed(uint256 index)
    external view returns (bool)
    {
        return __claimedBitMap.get(index);
    }

    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof)
    external
    {
        require(!__claimedBitMap.get(index), "P00lsCreatorToken::claim: drop already claimed");

        require(MerkleProof.verify(merkleProof, __merkleRoot, keccak256(abi.encodePacked(index, account, amount))), "P00lsCreatorToken::claim: invalid merkle proof");

        __claimedBitMap.set(index);
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

    function _mint(address account, uint256 amount)
    internal virtual override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._mint(account, amount);
    }

    function _burn(address account, uint256 amount)
    internal virtual override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._burn(account, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount)
    internal virtual override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._afterTokenTransfer(from, to, amount);
    }
}
