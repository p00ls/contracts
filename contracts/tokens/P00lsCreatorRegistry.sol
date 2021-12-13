// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../utils/Beacon.sol";
import "../utils/BeaconProxy.sol";
import "../utils/RegistryOwnableUpgradeable.sol";
import "./P00lsTokenCreator.sol";
import "./P00lsTokenXCreator.sol";

contract P00lsCreatorRegistry is
    ERC721URIStorageUpgradeable,
    RegistryOwnableUpgradeable,
    UUPSUpgradeable
{
    Beacon private __beaconCreator;
    Beacon private __beaconXCreator;
    string private __baseURI;

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
    function createToken(
        address owner,
        string calldata name,
        string calldata symbol,
        string calldata xname,
        string calldata xsymbol,
        bytes32 root
    )
    external virtual onlyOwner() returns (address)
    {
        address creator  = address(new BeaconProxy(__beaconCreator));
        address xCreator = address(new BeaconProxy(__beaconXCreator));

        P00lsTokenCreator(creator).initialize(
            name,
            symbol,
            root,
            xCreator
        );
        P00lsTokenXCreator(xCreator).initialize(
            xname,
            xsymbol,
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
        return uint256(uint160(spender)) == tokenId || super._isApprovedOrOwner(spender, tokenId);
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

    /**
     * Upgradeability
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        virtual
        override
        onlyOwner()
    {}
}
