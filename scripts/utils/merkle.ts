import { ethers } from 'ethers';
import MerkleTree from 'merkletreejs';
import keccak256  from 'keccak256';

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

export function createMerkleTree(leaves: Buffer[]) : MerkleTree {
  return new MerkleTree(leaves, keccak256, { sort: true });
}

export function hashAllocation(allocation: Allocation): Buffer {
  return Buffer.from(ethers.utils.solidityKeccak256([
    'uint256',
    'address',
    'uint256',
  ],[
    allocation.index,
    allocation.account,
    allocation.amount,
  ]).slice(2), 'hex');
}

export function hashVesting(vesting: Vesting): Buffer {
  return Buffer.from(ethers.utils.solidityKeccak256([
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
  ]).slice(2), 'hex');
}
