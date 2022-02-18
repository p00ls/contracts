// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./IERC4626.sol";

abstract contract ERC4626Upgradeable is IERC4626, ERC20Upgradeable {
    function asset() public view virtual override returns (address);

    function totalAssets() public view virtual override returns (uint256) {
        return IERC20MetadataUpgradeable(asset()).balanceOf(address(this));
    }

    function assetsPerShare() public view virtual override returns (uint256) {
        return _sharesToAssets(10 ** decimals());
    }

    function assetsOf(address depositor) public view virtual override returns (uint256) {
        return totalAssets() * balanceOf(depositor) / totalSupply();
    }

    function maxDeposit(address /*caller*/) public view virtual override returns (uint256) {
        return type(uint256).max;
    }

    function previewDeposit(uint256 assets) public view virtual override returns (uint256) {
        return _assetsToShares(assets);
    }

    function deposit(uint256 assets, address receiver) public virtual override returns (uint256) {
        uint256 shares = previewDeposit(assets);
        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(asset()), _msgSender(), address(this), assets);
        _mint(receiver, shares);
        return shares;
    }

    function maxMint(address /*caller*/) public view virtual override returns (uint256) {
        return type(uint256).max;
    }

    function previewMint(uint256 shares) public view virtual override returns (uint256) {
        return _sharesToAssets(shares);
    }

    function mint(uint256 shares, address receiver) public virtual override returns (uint256) {
        uint256 assets = _sharesToAssets(shares);
        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(asset()), _msgSender(), address(this), assets);
        _mint(receiver, shares);
        return assets;
    }

    function maxWithdraw(address caller) public view virtual override returns (uint256) {
        return assetsOf(caller);
    }

    function previewWithdraw(uint256 assets) public view virtual override returns (uint256) {
        return _assetsToShares(assets);
    }

    function withdraw(uint256 assets, address receiver, address owner) public virtual override returns (uint256) {
        address sender = _msgSender();
        uint256 shares = previewWithdraw(assets);

        if (sender != owner) {
            _spendAllowance(owner, sender, shares);
        }

        _burn(owner, shares);
        SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(asset()), receiver, assets);
        return shares;
    }

    function maxRedeem(address caller) public view virtual override returns (uint256) {
        return balanceOf(caller);
    }

    function previewRedeem(uint256 shares) public view virtual override returns (uint256) {
        return _sharesToAssets(shares);
    }

    function redeem(uint256 shares, address receiver, address owner) public virtual override returns (uint256) {
        address sender = _msgSender();
        uint256 assets = previewRedeem(shares);

        if (sender != owner) {
            _spendAllowance(owner, sender, shares);
        }

        _burn(owner, shares);
        SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(asset()), receiver, assets);
        return assets;
    }

    function _sharesToAssets(uint256 shares) internal view virtual returns (uint256 assets) {
        return totalAssets() == 0 || totalSupply() == 0
            ? shares * (10 ** IERC20MetadataUpgradeable(asset()).decimals()) / (10 ** decimals())
            : shares * totalAssets() / totalSupply();
    }

    function _assetsToShares(uint256 assets) internal view virtual returns (uint256 shares) {
        return totalAssets() == 0 || totalSupply() == 0
            ? assets * (10 ** decimals()) / (10 ** IERC20MetadataUpgradeable(asset()).decimals())
            : assets * totalSupply() / totalAssets();
    }
}