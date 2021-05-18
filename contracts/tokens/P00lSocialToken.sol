// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../utils/RegistryOwnable.sol";

// TODO: use onlyOwner to perform admin operations
contract P00lSocialToken is ERC20PermitUpgradeable, RegistryOwnable
{
    bytes32 public merkleRoot;
    mapping(address => bool) public claimed;

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

    function claim(address account, uint256 amount, bytes32[] calldata proof)
    external
    {
        require(!claimed[account], "Token have already been claimed");
        require(MerkleProof.verify(proof, merkleRoot, keccak256(abi.encodePacked(account, amount))), "Invalid merkle proof");

        claimed[account] = true;
        _mint(account, amount);
    }
}
