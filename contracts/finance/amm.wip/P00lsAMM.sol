// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./UniswapV2/UniswapV2Factory.sol";
import "./UniswapV2/UniswapV2Pair.sol";
import "./P00lsSettings01.sol";

contract P00lsAMMPair is UniswapV2Pair
{
    uint256 public openning;

    function initialize(address _token0, address _token1)
    public virtual override
    {
        super.initialize(_token0, _token1);
        openning = block.timestamp + IP00lsSettings(P00lsAMMFactory(factory).settings()).delay();
    }

    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data)
    public virtual override
    {
        if (openning > block.timestamp) {
            require(IP00lsSettings(P00lsAMMFactory(factory).settings()).isSwapAuthorized(to), "P00lsAMMPair: not yet publicly open");
        }
        super.swap(amount0Out, amount1Out, to, data);
    }
}

contract P00lsAMMFactory is UniswapV2Factory
{
    address public settings;
    event SettingsUpdated(address oldSettings, address newSettings);

    constructor(address _admin)
    UniswapV2Factory(_admin, address(new P00lsAMMPair()))
    {
        settings = address(new P00lsSettings01(_admin));
    }

    function updateSettings(address _newSettings) public virtual onlyOwner()
    {
        emit SettingsUpdated(settings, _newSettings);
        settings = _newSettings;
    }
}
