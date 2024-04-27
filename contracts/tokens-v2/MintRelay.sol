// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {AccessControl}   from "@openzeppelin/contracts/access/AccessControl.sol";
import {ECDSA}           from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712}          from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Address}         from "@openzeppelin/contracts/utils/Address.sol";
import {P00lsV2Registry} from "./P00lsV2Registry.sol";

/// @custom:security-contact security@p00ls.com
contract MintRelay is AccessControl, EIP712 {
    using ECDSA for bytes32;

    P00lsV2Registry public  immutable registry;
    bytes32         public  constant  MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32         private constant  CREATE_TOKEN_TYPEHASH = keccak256("CreateToken(address owner,string name,string symbol,bytes32 root,bytes32 fees)");


    constructor(P00lsV2Registry _registry, address _admin) EIP712("P00ls Minter Relay", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        registry = _registry;
    }

    function createToken(
        address owner,
        string calldata name,
        string calldata symbol,
        bytes32 root,
        bytes32 fees,
        bytes calldata signature
    )
        external
        payable
        returns (address)
    {
        // recover signer
        address signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CREATE_TOKEN_TYPEHASH,
                    owner,
                    keccak256(bytes(name)),
                    keccak256(bytes(symbol)),
                    root,
                    fees
                )
            )
        ).recover(signature);

        // check signature
        _checkRole(MINTER_ROLE, signer);

        // parse and process fee
        address feeReceiver = address(bytes20(fees));
        uint96  feeAmount   = uint96(uint256(fees));

        if (msg.value != feeAmount) {
            revert("Invalid payment");
        } else if (feeAmount > 0) {
            Address.sendValue(payable(feeReceiver), feeAmount);
        }

        // execute operation
        return registry.createToken2(owner, name, symbol, root);
    }
}