// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@amxx/hre/contracts/ENSReverseRegistration.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@amxx/hre/contracts/FullMath.sol";
import "../../tokens/interfaces.sol";

interface IEscrowReceiver {
    function onEscrowRelease(uint256) external;
}

contract Escrow is AccessControl, Multicall {
    using SafeCast for uint256;

    bytes32 public constant ESCROW_MANAGER_ROLE = keccak256("ESCROW_MANAGER_ROLE");

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
        _setupRole(DEFAULT_ADMIN_ROLE,  _admin);
        _setupRole(ESCROW_MANAGER_ROLE, _admin);
    }

    function configure(IP00lsTokenCreator token, uint64 start, uint64 stop)
        external
        onlyRole(ESCROW_MANAGER_ROLE)
    {
        require(start > 0, "Invalid input: start should be non 0");
        require(stop > start, "Invalid input: start must be before stop");

        Details storage manifest = manifests[token];
        require(
            manifest.beneficiary == address(0) || token.balanceOf(address(this)) == 0,
            "Release already active"
        );
        manifest.lastUpdate  = start;
        manifest.deadline    = stop;
        manifest.beneficiary = address(token.xCreatorToken());

        emit NewStaking(token, start, stop);
    }

    function release(IERC20 token)
        external
        returns (uint256)
    {
        Details memory manifest = manifests[token];

        if (manifest.lastUpdate == 0 || block.timestamp <= manifest.lastUpdate)
        {
            return 0;
        }

        uint256 balance = token.balanceOf(address(this));

        if (block.timestamp < manifest.deadline)
        {
            uint64  step         = block.timestamp.toUint64() - manifest.lastUpdate;
            uint64  total        = manifest.deadline          - manifest.lastUpdate;
            balance              = FullMath.mulDiv(step, total, balance);
            manifest.lastUpdate  = block.timestamp.toUint64();
        }
        else
        {
            manifest.lastUpdate = 0;
        }

        if (balance > 0)
        {
            SafeERC20.safeTransfer(token, manifest.beneficiary, balance);
            if (Address.isContract(manifest.beneficiary)) {
                try IEscrowReceiver(manifest.beneficiary).onEscrowRelease(balance) {}
                catch {}
            }
        }

        return balance;
    }

    function setName(address ensregistry, string calldata ensname)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        ENSReverseRegistration.setName(ensregistry, ensname);
    }
}