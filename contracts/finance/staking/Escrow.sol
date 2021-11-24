// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@amxx/hre/contracts/FullMath.sol";
import "../../tokens/interfaces.sol";

contract Escrow is AccessControl {
    using SafeCast for uint256;

    /*****************************************************************************************************************
     *                                                    Storage                                                    *
     *****************************************************************************************************************/
    struct Details {
        uint64  lastUpdate;
        uint64  deadline;
        address beneficiary;
    }

    mapping (IERC20 => Details) public manifests;

    /*****************************************************************************************************************
     *                                                    Events                                                     *
     *****************************************************************************************************************/
    event NewStaking(IERC20 indexed token, uint64 start, uint64 stop);

    /*****************************************************************************************************************
     *                                                   Functions                                                   *
     *****************************************************************************************************************/
    constructor(address _admin)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    }

    function configure(IP00lsCreatorToken token, uint64 start, uint64 stop)
    external onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(stop > start, "Invalid input: start must be before stop");

        Details storage manifest = manifests[token];
        require(
            manifest.beneficiary == address(0) || token.balanceOf(address(this)) == 0,
            "Release already active"
        );
        manifest.lastUpdate  = start;
        manifest.deadline    = stop;
        manifest.beneficiary = token.xCreatorToken();

        emit NewStaking(token, start, stop);
    }

    function release(IERC20 token)
    external
    {
        Details storage manifest = manifests[token];

        if (manifest.lastUpdate == 0 || block.timestamp <= manifest.lastUpdate)
        {
            return;
        }

        uint256 balance = token.balanceOf(address(this));

        if (block.timestamp < manifest.deadline)
        {
            uint64  step         = block.timestamp.toUint64() - manifest.lastUpdate;
            uint64  total        = manifest.deadline          - manifest.lastUpdate;
            balance              = FullMath.mulDiv(step, total, balance);
            manifest.lastUpdate  = block.timestamp.toUint64();
        }

        if (balance > 0) {
            SafeERC20.safeTransfer(token, manifest.beneficiary, balance);
        }
    }
}