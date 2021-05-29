// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../utils/RegistryOwnable.sol";
import "./extensions/ERC1363Upgradeable.sol";

// TODO: use onlyOwner to perform admin operations
contract P00lsSocialToken is ERC20PermitUpgradeable, ERC1363Upgradeable, RegistryOwnable
{
    bytes32 public merkleRoot;
    mapping(uint256 => uint256) private claimedBitMap;

    constructor()
    RegistryOwnable(IERC721(msg.sender))
    initializer
    {}

    function initialize(string calldata name, string calldata symbol, bytes32 root)
    external initializer
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        merkleRoot = root;
    }

    function isClaimed(uint256 index)
    public view returns (bool)
    {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        uint256 claimedWord = claimedBitMap[claimedWordIndex];
        uint256 mask = (1 << claimedBitIndex);
        return claimedWord & mask == mask;
    }

    function _setClaimed(uint256 index)
    private
    {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        claimedBitMap[claimedWordIndex] = claimedBitMap[claimedWordIndex] | (1 << claimedBitIndex);
    }

    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof)
    external
    {
        require(!isClaimed(index), "P00lsSocialToken::claim: drop already claimed");

        require(MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encodePacked(index, account, amount))), "P00lsSocialToken::claim: invalid merkle proof");

        _setClaimed(index);
        _mint(account, amount);
    }
}
