// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import "../utils/RegistryOwnable.sol";
import "./P00lsTokenBase.sol";
import "./interfaces.sol";

// TODO: use onlyOwner & onlyAdmin to perform admin operations
contract P00lsCreatorToken is P00lsTokenBase, RegistryOwnable
{
    using BitMaps for BitMaps.BitMap;

    IP00lsCreatorXToken public xCreatorToken;
    bytes32             public merkleRoot;
    BitMaps.BitMap      private __claimedBitMap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address registry)
    RegistryOwnable(registry)
    initializer
    {}

    function initialize(string calldata name, string calldata symbol, bytes32 root, address child)
    external initializer
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        merkleRoot = root;
        xCreatorToken = IP00lsCreatorXToken(child);
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

        require(MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encodePacked(index, account, amount))), "P00lsCreatorToken::claim: invalid merkle proof");

        __claimedBitMap.set(index);
        _mint(account, amount);
    }

    function owner()
    public view virtual override(P00lsTokenBase, RegistryOwnable) returns (address)
    {
        return super.owner();
    }

    /**
     * xCreatorToken bindings
     */
    function _delegate(address delegator, address delegatee)
    internal virtual override
    {
        super._delegate(delegator, delegatee);
        xCreatorToken.__delegate(delegator, delegatee);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        if (_msgSender() == address(xCreatorToken)) {
            _transfer(sender, recipient, amount);
            return true;
        } else {
            return super.transferFrom(sender, recipient, amount);
        }
    }
}
