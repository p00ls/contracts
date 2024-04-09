// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC4906}                      from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {Create2}                       from "@openzeppelin/contracts/utils/Create2.sol";
import {AccessControlUpgradeable}      from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable}               from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ERC721Upgradeable}             from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {MulticallUpgradeable}          from "@openzeppelin/contracts-upgradeable/utils/MulticallUpgradeable.sol";
import {Beacon}                        from "../utils-v2/Beacon.sol";
import {Conversion}                    from "../utils-v2/Conversion.sol";
import {HybridProxy}                   from "../utils-v2/HybridProxy.sol";
import {RegistryOwnableUpgradeable}    from "../utils-v2/RegistryOwnableUpgradeable.sol";
import {AccessControlOwnedUpgradeable} from "../utils-v2/AccessControlOwnedUpgradeable.sol";

/// @custom:security-contact security@p00ls.com
contract RegistryBase is
    AccessControlOwnedUpgradeable,
    Beacon,
    ERC721Upgradeable,
    RegistryOwnableUpgradeable,
    UUPSUpgradeable,
    MulticallUpgradeable
{
    using Conversion for address;

    bytes32 public constant REGISTRY_MANAGER_ROLE = keccak256("REGISTRY_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE         = keccak256("UPGRADER_ROLE");

    string private __baseURI;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor()
    {
        _disableInitializers();
    }

    function initialize(address _admin, string memory _name, string memory _symbol)
        external
        initializer()
    {
        __AccessControl_init();
        __ERC721_init(_name, _symbol);
        __RegistryOwnable_init(address(this));
        _mint(_admin, address(this).toUint256());
    }

    // Token instance deployment
    function _createProxy(address beaconOrImpl)
        internal
        returns (address)
    {
        return address(new HybridProxy(beaconOrImpl));
    }

    function _createProxy(address beaconOrImpl, bytes32 salt)
        internal
        returns (address)
    {
        return address(new HybridProxy{ salt: salt }(beaconOrImpl));
    }

    function _predictProxy(address beaconOrImpl, bytes32 salt)
        internal
        view
        returns (address)
    {
        return Create2.computeAddress(salt, keccak256(bytes.concat(type(HybridProxy).creationCode, abi.encode(beaconOrImpl))));
    }

    /// Token URI customization
    function setBaseURI(string memory baseURI)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        __baseURI = baseURI;
        emit IERC4906.BatchMetadataUpdate(0, type(uint256).max);
    }

    function _baseURI()
        internal
        view
        override
        returns (string memory)
    {
        return __baseURI;
    }

    // Token upgrade
    function upgradeTokens(address newImplementation)
        external
        onlyRole(UPGRADER_ROLE)
    {
        _setImplementation(newImplementation);
    }

    /*****************************************************************************************************************
     *                                                   OVERRIDES                                                   *
     *****************************************************************************************************************/

    // Introspection
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlUpgradeable, ERC721Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Ownership
    function owner()
        public
        view
        virtual
        override(AccessControlOwnedUpgradeable, RegistryOwnableUpgradeable)
        returns (address)
    {
        return super.owner();
    }

    // Upgradeability
    function _authorizeUpgrade(address newImplementation)
        internal
        virtual
        override
        onlyRole(UPGRADER_ROLE)
    {}

    // Support transferOwnership by the tokenized contracts
    function _isAuthorized(address holder, address spender, uint256 tokenId)
        internal
        view
        virtual
        override
        returns (bool)
    {
        return super._isAuthorized(holder, spender, tokenId) || spender.toUint256() == tokenId;
    }
}