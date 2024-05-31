// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20, ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20}     from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA}         from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712}        from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Address}       from "@openzeppelin/contracts/utils/Address.sol";
import {NoncesWithKey} from "../utils/NoncesWithKey.sol";

struct Distribution {
    address owner;
    Allocation[] allocations;
    uint256 nonce;
}

struct Allocation {
    IERC20 token;
    address recipient;
    uint256 amount;
}

/// @custom:security-contact security@p00ls.com
contract DistributionProtocol is
    ERC20("P00ls Distribution", "p00ls-distribution"),
    EIP712("P00ls Distribution", "1"),
    NoncesWithKey
{
    using ECDSA for bytes32;

    uint256 public   immutable FEE_PER_ALLOCATION         = 0.000001 ether; // TODO
    bytes32 internal constant  _DISTRIBUTION_TYPEHASH     = keccak256("Distribution(address owner,Allocation[] allocations,uint256 nonce)Allocation(address token,address recipient,uint256 amount)");
    bytes32 internal constant  _ALLOCATION_TYPEHASH       = keccak256("Allocation(address token,address recipient,uint256 amount)");
    uint256 internal constant  _GAS_OFFSET                = 43_850;
    uint256 internal constant  _GAS_OFFSET_PER_ALLOCATION = 865;

    mapping(address owner => mapping(address oracle => mapping(IERC20 token => bool))) private _authorized;

    event AuthorizationUpdate(address indexed owner, address indexed oracle, IERC20 indexed token, bool allowed);
    error Unauthorized(address owner, address oracle, IERC20 token);

    /****************************************************************************************************************
     *                                                GAS MANAGEMENT                                                *
     ****************************************************************************************************************/
    receive() external payable {
        _mint(msg.sender, msg.value);
    }

    function deposit(address to) public payable {
        _mint(to, msg.value);
    }

    function withdraw(address payable to, uint256 amount) public {
        _burn(msg.sender, amount);
        Address.sendValue(to, amount);
    }

    function withdrawFrom(address from, address payable to, uint256 amount) public {
        _spendAllowance(from, msg.sender, amount);
        _burn(msg.sender, amount);
        Address.sendValue(to, amount);
    }

    /****************************************************************************************************************
     *                                              TOKEN DISTRIBUTION                                              *
     ****************************************************************************************************************/
    function setOracle(address oracle, IERC20 token, bool allowed) public {
        _authorized[msg.sender][oracle][token] = allowed;
        emit AuthorizationUpdate(msg.sender, oracle, token, allowed);
    }

    function isAuthorized(address owner, address oracle, IERC20 token) public view returns (bool) {
        return _authorized[owner][oracle][token];
    }

    function process(
        address owner,
        Allocation[] calldata allocations,
        uint256 nonce,
        bytes calldata signature
    ) external {
        uint256 initialGas = gasleft();

        // get hashes
        bytes32[] memory allocationHashes = new bytes32[](allocations.length);
        for (uint256 i = 0; i < allocations.length; ++i) {
            allocationHashes[i] = keccak256(abi.encode(
                _ALLOCATION_TYPEHASH,
                allocations[i].token,
                allocations[i].recipient,
                allocations[i].amount
            ));
        }

        // recover oracle from signature
        address oracle = _hashTypedDataV4(keccak256(abi.encode(
            _DISTRIBUTION_TYPEHASH,
            owner,
            keccak256(abi.encodePacked(allocationHashes)),
            nonce
        ))).recover(signature);

        // validate oracle's nonce
        _useNonceOrRevert(oracle, nonce);

        // check each authorization, and transfer tokens
        for (uint256 i = 0; i < allocations.length; ++i) {
            if (!isAuthorized(owner, oracle, allocations[i].token)) {
                revert Unauthorized(owner, oracle, allocations[i].token);
            }
            SafeERC20.safeTransferFrom(allocations[i].token, owner, allocations[i].recipient, allocations[i].amount);
        }

        // fees
        uint256 oracleFee = FEE_PER_ALLOCATION * allocations.length;
        Address.sendValue(payable(oracle), oracleFee);

        uint256 gasRefund = (initialGas - gasleft() + _GAS_OFFSET + _GAS_OFFSET_PER_ALLOCATION * allocations.length) * tx.gasprice; // Not everything, need tunning
        Address.sendValue(payable(tx.origin), gasRefund);

        _burn(owner, oracleFee + gasRefund);
    }
}