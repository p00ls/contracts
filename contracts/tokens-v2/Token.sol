// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {ERC1967Utils}                  from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";
import {MerkleProof}                   from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {BitMaps}                       from "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import {AccessControlUpgradeable}      from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC20Upgradeable}              from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable}        from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {ERC20VotesUpgradeable}         from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import {MulticallUpgradeable}          from "@openzeppelin/contracts-upgradeable/utils/MulticallUpgradeable.sol";
import {NoncesUpgradeable}             from "@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol";
import {RegistryOwnable}               from "../utils-v2/RegistryOwnable.sol";
import {AccessControlOwnedUpgradeable} from "../utils-v2/AccessControlOwnedUpgradeable.sol";
import {ERC1363Upgradeable}            from "./extensions/ERC1363Upgradeable.sol";
import {ERC1046Upgradeable}            from "./extensions/ERC1046Upgradeable.sol";

/// @custom:security-contact security@p00ls.com
abstract contract Token is
    AccessControlOwnedUpgradeable,
    RegistryOwnable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    ERC1046Upgradeable,
    ERC1363Upgradeable,
    MulticallUpgradeable
{
    using BitMaps for BitMaps.BitMap;

    bytes32 public   constant  WHITELISTER = keccak256("WHITELISTER");
    bytes32 public   constant  WHITELISTED = keccak256("WHITELISTED");
    address internal immutable self        = address(this);

    bool           public isOpen;
    bytes32        public merkleRoot;
    BitMaps.BitMap private __claimedBitMap;

    event Opened();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address registry)
        RegistryOwnable(registry)
    {
        _disableInitializers();
    }

    function initialize(string calldata name, string calldata symbol, bytes32 root)
        external
        initializer()
    {
        __AccessControl_init();
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        _setRoleAdmin(WHITELISTED, WHITELISTER);
        merkleRoot = root;
    }

    // Mint
    function isClaimed(uint256 index)
        public
        view
        returns (bool)
    {
        return __claimedBitMap.get(index);
    }

    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof)
        public
    {
        require(!isClaimed(index), "P00lsTokenCreator::claim: drop already claimed");

        require(MerkleProof.verify(merkleProof, merkleRoot, keccak256(abi.encodePacked(index, account, amount))), "P00lsTokenCreator::claim: invalid merkle proof");

        __claimedBitMap.set(index);
        _mint(account, amount);
    }

    // Whitelist
    function open() public virtual onlyOwner() {
        isOpen = true;
        emit Opened();
    }

    // Admin
    // function setTokenURI(string calldata _tokenURI)
    //     external
    // {
    //     require(owner() == msg.sender, "P00lsToken: restricted");
    //     _setTokenURI(_tokenURI);
    // }

    // Block upgradeability
    function lockUpgradeability() public onlyOwner() {
        address implementation = ERC1967Utils.getImplementation();
        require(implementation != self, "Implementation already locked");
        ERC1967Utils.upgradeToAndCall(implementation, "");
    }

    /*****************************************************************************************************************
     *                                                   OVERRIDES                                                   *
     *****************************************************************************************************************/

    // Introspection
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlUpgradeable, ERC1363Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Ownership
    function owner()
        public
        view
        virtual
        override(AccessControlOwnedUpgradeable, RegistryOwnable)
        returns (address)
    {
        return super.owner();
    }

    // Nonces
    function nonces(address user)
        public
        view
        virtual
        override(ERC20PermitUpgradeable, NoncesUpgradeable)
        returns (uint256)
    {
        return super.nonces(user);
    }

    // Token update
    function _update(address from, address to, uint256 amount)
        internal
        virtual
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        require(
            from == address(0)         || // mint should always be allowed to avoid funds gettign stuck in the bridge
            isOpen                     || // if contract is open, all transfer are allowed
            hasRole(WHITELISTED, from) || // if either from or to is whitelisted, transfer can happen
            hasRole(WHITELISTED, to),
            "Transfer restricted to whitelisted"
        );
        super._update(from, to, amount);
    }
}