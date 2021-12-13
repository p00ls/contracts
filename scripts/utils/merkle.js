"use strict";
exports.__esModule = true;
exports.hashVesting = exports.hashAllocation = exports.createMerkleProof = exports.createMerkleTree = void 0;
var ethers_1 = require("ethers");
var merkletreejs_1 = require("merkletreejs");
var keccak256 = require("keccak256");
function createMerkleTree(leaves) {
    return new merkletreejs_1.MerkleTree(leaves.map(function (leaf) { return ethers_1.ethers.utils.hexlify(leaf); }), keccak256, { sort: true });
}
exports.createMerkleTree = createMerkleTree;
function createMerkleProof(tree, leaf) {
    return tree.getHexProof(ethers_1.ethers.utils.hexlify(leaf));
}
exports.createMerkleProof = createMerkleProof;
function hashAllocation(allocation) {
    return ethers_1.ethers.utils.solidityKeccak256([
        'uint256',
        'address',
        'uint256',
    ], [
        allocation.index,
        allocation.account,
        allocation.amount,
    ]);
}
exports.hashAllocation = hashAllocation;
function hashVesting(vesting) {
    return ethers_1.ethers.utils.solidityKeccak256([
        'uint64',
        'uint64',
        'uint64',
        'uint64',
        'address',
        'address',
        'uint256',
    ], [
        vesting.index,
        vesting.start,
        vesting.cliff,
        vesting.duration,
        vesting.token,
        vesting.recipient,
        vesting.amount,
    ]);
}
exports.hashVesting = hashVesting;
