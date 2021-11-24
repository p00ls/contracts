// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "../utils/Beacon.sol";
import "../utils/RegistryOwnableUpgradeable.sol";
import "./P00lsCreatorToken.sol";
import "./P00lsCreatorXToken.sol";

contract P00lsCreatorRegistry is
    ERC721URIStorageUpgradeable,
    RegistryOwnableUpgradeable
{
    Beacon private __beaconCreator;
    Beacon private __beaconXCreator;
    string private __baseURI;

    event Upgraded(address indexed implementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor()
    initializer
    {}

    function initialize(
        address       _admin,
        string memory _name,
        string memory _symbol
    )
    external initializer
    {
        __ERC721_init(_name, _symbol);
        __RegistryOwnable_init(address(this));
        _mint(_admin, uint256(uint160(address(this))));

        __beaconCreator  = new Beacon();
        __beaconXCreator = new Beacon();
    }

    /**
     * Creator token creation
     */
    function createToken(address owner, string calldata name, string calldata symbol, bytes32 root)
    external virtual onlyOwner() returns (address)
    {
        address creator  = address(new BeaconProxy(address(__beaconCreator),  new bytes(0)));
        address xCreator = address(new BeaconProxy(address(__beaconXCreator), new bytes(0)));

        P00lsCreatorToken(creator).initialize(
            name,
            symbol,
            root,
            xCreator
        );
        P00lsCreatorXToken(xCreator).initialize(
            string(abi.encodePacked('x', name  )),
            string(abi.encodePacked('x', symbol)),
            creator
        );

        _mint(owner, uint256(uint160(creator)));
        return creator;
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
    function upgradeCreatorToken(address newImplementation)
    external onlyOwner()
    {
        __beaconCreator.upgradeTo(newImplementation);
    }

    function upgradeXCreatorToken(address newImplementation)
    external onlyOwner()
    {
        __beaconXCreator.upgradeTo(newImplementation);
    }

    /**
     * ENS
     */
    function setName(address ensregistry, string calldata ensname)
    external onlyOwner()
    {
        ENSReverseRegistration.setName(ensregistry, ensname);
    }
}
