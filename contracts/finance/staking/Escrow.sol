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
        _configure(token, start, stop, address(token.xCreatorToken()));
    }

    function configureWithBeneficary(IERC20 token, uint64 start, uint64 stop, address beneficiary)
        external
        onlyRole(ESCROW_MANAGER_ROLE)
    {
        try IP00lsTokenCreator(address(token)).xCreatorToken() returns (IP00lsTokenXCreator tokenXCreator) {
            // if the token is an IP00lsTokenCreator, then the beneficiary must be the corresponding tokenXcreator
            require(beneficiary == address(tokenXCreator));
        } catch {
            // it the token is not an IP00lsTokenCreator, its ok to have another beneficiary
        }

        _configure(token, start, stop, beneficiary);
    }

    function _configure(IERC20 token, uint64 start, uint64 stop, address beneficiary)
        internal
    {
        release(token); // this will reset if previous is schedule is over

        require(start > 0, "Invalid input: start should be non 0");
        require(stop >= start, "Invalid input: start must be before stop");

        Details storage manifest = manifests[token];
        require(manifest.lastUpdate == 0, "Release already active");

        manifest.lastUpdate  = start;
        manifest.deadline    = stop;
        manifest.beneficiary = beneficiary;

        emit NewStaking(token, start, stop);
    }

    function releasable(IERC20 token)
        public
        view
        returns (uint256)
    {
        Details memory manifest = manifests[token];

        if (manifest.lastUpdate == 0 || block.timestamp <= manifest.lastUpdate)
        {
            return 0;
        }
        else if (block.timestamp < manifest.deadline)
        {
            uint64 step  = block.timestamp.toUint64() - manifest.lastUpdate;
            uint64 total = manifest.deadline          - manifest.lastUpdate;
            return FullMath.mulDiv(step, total, token.balanceOf(address(this)));
        }
        else
        {
            return token.balanceOf(address(this));
        }
    }

    function release(IERC20 token)
        public
        returns (uint256)
    {
        Details memory manifest = manifests[token];

        uint256 toRelease = releasable(token);
        if (toRelease > 0)
        {
            manifests[token].lastUpdate = block.timestamp.toUint64();

            SafeERC20.safeTransfer(token, manifest.beneficiary, toRelease);
            if (Address.isContract(manifest.beneficiary))
            {
                try IEscrowReceiver(manifest.beneficiary).onEscrowRelease(toRelease) {}
                catch {}
            }
        }
        if (block.timestamp >= manifest.deadline)
        {
            delete manifests[token];
        }

        return toRelease;
    }

    function setName(address ensregistry, string calldata ensname)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        ENSReverseRegistration.setName(ensregistry, ensname);
    }
}