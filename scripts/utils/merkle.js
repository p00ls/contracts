const { ethers } = require('hardhat');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

function createMerkleTree(leaves) {
  return new MerkleTree(leaves, keccak256, { sort: true });
}

function hashAllocation({ index, account, amount }) {
  return Buffer.from(ethers.utils.solidityKeccak256(['uint256', 'address', 'uint256'], [index, account, amount]).slice(2), 'hex');
}

module.exports = {
  createMerkleTree,
  hashAllocation,
}
