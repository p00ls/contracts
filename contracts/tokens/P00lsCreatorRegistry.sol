// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../utils/RegistryOwnableUpgradeable.sol";
import "./P00lsCreatorToken.sol";

contract P00lsCreatorRegistry is
    ERC721URIStorageUpgradeable,
    RegistryOwnableUpgradeable
{
    address internal _template;
    string internal __baseURI;

    function initialize(address _admin, string memory  _name, string memory  _symbol)
    external initializer
    {
        __ERC721_init(_name, _symbol);
        __RegistryOwnable_init(address(this));
        _mint(_admin, uint256(uint160(address(this))));

        _template = address(new P00lsCreatorToken());
    }

    function createToken(address owner, string calldata name, string calldata symbol, bytes32 root)
    external virtual onlyOwner() returns (address)
    {
        address instance = Clones.clone(_template);
        P00lsCreatorToken(instance).initialize(name, symbol, root);
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

    function setName(address ensregistry, string calldata ensname) external onlyOwner() {
        ENSReverseRegistration.setName(ensregistry, ensname);
    }
}
