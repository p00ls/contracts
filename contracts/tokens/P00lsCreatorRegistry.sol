// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "../utils/RegistryOwnableUpgradeable.sol";
import "./P00lsCreatorToken.sol";

contract P00lsCreatorRegistry is
    ERC721URIStorageUpgradeable,
    RegistryOwnableUpgradeable,
    IBeacon
{
    address internal _implementation;
    string internal __baseURI;

    event Upgraded(address indexed implementation);

    function initialize(address _admin, string memory  _name, string memory  _symbol)
    external initializer
    {
        __ERC721_init(_name, _symbol);
        __RegistryOwnable_init(address(this));
        _mint(_admin, uint256(uint160(address(this))));
    }

    /**
     * Creator token creation
     */
    function createToken(address owner, string calldata name, string calldata symbol, bytes32 root)
    external virtual onlyOwner() returns (address)
    {
        address instance = address(new BeaconProxy(
            address(this),
            abi.encodeWithSelector(
                P00lsCreatorToken.initialize.selector,
                name,
                symbol,
                root
            )
        ));
        _mint(owner, uint256(uint160(instance)));
        return instance;
    }

    /**
     * Support transferOwnership by the tokenized contracts
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId)
    internal view virtual override returns (bool)
    {
        return super._isApprovedOrOwner(spender, tokenId)
            || uint256(uint160(spender)) == tokenId;
    }

    /**
     * Token URI customization
     */
    function setTokenURI(uint256 tokenId, string memory _tokenURI)
    external
    {
        require(msg.sender == ownerOf(tokenId), "ERC721: Only owner can set URI");
        _setTokenURI(tokenId, _tokenURI);
    }

    function setBaseURI(string memory baseURI)
    external virtual onlyOwner()
    {
        __baseURI = baseURI;
    }

    function _baseURI()
    internal view virtual override returns (string memory)
    {
        return __baseURI;
    }

    /**
     * Beacon
     */
    function implementation()
    external view override returns (address)
    {
        return _implementation;
    }

    function upgradeTo(address newImplementation)
    external onlyOwner()
    {
        _implementation = newImplementation;
        emit Upgraded(newImplementation);
    }

    /**
     * ENS
     */
    function setName(address ensregistry, string calldata ensname) external onlyOwner() {
        ENSReverseRegistration.setName(ensregistry, ensname);
    }
}
