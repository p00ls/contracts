// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../utils/ENSReverseRegistration.sol";
import "./extensions/ERC1046Upgradeable.sol";
import "./extensions/ERC1363Upgradeable.sol";

/* TODO: distribution & features */
contract P00ls is
    ERC20VotesUpgradeable,
    ERC1046Upgradeable,
    ERC1363Upgradeable,
    OwnableUpgradeable
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize(string calldata name, string calldata symbol)
    external initializer
    {
        __ERC20_init(name, symbol);
        __ERC20Permit_init(name);
        __Ownable_init();
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
