import { ethers     } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import * as keccak256 from 'keccak256';

export interface Allocation {
  index:   ethers.BigNumberish;
  account: string;
  amount:  ethers.BigNumberish;
}

export interface Vesting {
  index:     ethers.BigNumberish;
  start:     ethers.BigNumberish;
  cliff:     ethers.BigNumberish;
  duration:  ethers.BigNumberish;
  token:     string;
  recipient: string;
  amount:    ethers.BigNumberish;
}

export function createMerkleTree(leaves: ethers.BytesLike[]) : MerkleTree {
  return new MerkleTree(leaves.map(leaf => ethers.utils.hexlify(leaf)), keccak256, { sort: true });
}

export function createMerkleProof(tree: MerkleTree, leaf: ethers.BytesLike) : ethers.BytesLike[] {
  return tree.getHexProof(ethers.utils.hexlify(leaf));
}

export function hashAllocation(allocation: Allocation): ethers.BytesLike {
  return ethers.utils.solidityKeccak256([
    'uint256',
    'address',
    'uint256',
  ],[
    allocation.index,
    allocation.account,
    allocation.amount,
  ]);
}

export function hashVesting(vesting: Vesting): ethers.BytesLike {
  return ethers.utils.solidityKeccak256([
    'uint64',
    'uint64',
    'uint64',
    'uint64',
    'address',
    'address',
    'uint256',
  ],[
    vesting.index,
    vesting.start,
    vesting.cliff,
    vesting.duration,
    vesting.token,
    vesting.recipient,
    vesting.amount,
  ]);
}
