// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract VestedAirdrops is
  AccessControl,
  Multicall
{
  struct Schedule {
    uint256 id; // salt
    IERC20  token;
    address recipient;
    uint256 amount;
    uint256 start;
    uint256 cliff;
    uint256 duration;
  }

  mapping(bytes32 => bool)    private _airdrops;
  mapping(bytes32 => uint256) private _released;

  event Airdrop(bytes32 indexed airdrop, bool enabled);
  event TokensReleased(bytes32 indexed airdrop, IERC20 indexed token, address indexed recipient, uint256 amount);

  constructor(address admin) {
    _setupRole(DEFAULT_ADMIN_ROLE, admin);
  }

  function enableAirdrop(bytes32 root, bool enable) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _airdrops[root] = enable;
    emit Airdrop(root, enable);
  }

  function released(Schedule  memory schedule) public view returns (uint256) {
    return _released[keccak256(abi.encode(schedule))];
  }

  function release(
    Schedule  memory schedule,
    bytes32          airdrop, // TODO: remove when MerkleProof.getRoot becomes available
    bytes32[] memory proof
  ) public {
    // check input validity
    bytes32 leaf = keccak256(abi.encode(schedule));
    require(MerkleProof.verify(proof, airdrop, leaf));
    require(_airdrops[airdrop]);

    // compute vesting remains
    uint256 releasable = vestedAmount(schedule, block.timestamp) - _released[leaf];
    _released[leaf] += releasable;

    // emit notification
    emit TokensReleased(airdrop, schedule.token, schedule.recipient, schedule.amount);

    // do release (might have reentrancy)
    SafeERC20.safeTransfer(schedule.token, schedule.recipient, releasable);
  }

  function vestedAmount(Schedule memory schedule, uint256 timestamp) public pure returns (uint256) {
    return timestamp < schedule.start + schedule.cliff
    ? 0
    : Math.min(
        schedule.amount,
        schedule.amount * (timestamp - schedule.start) / schedule.duration
      );
  }
}