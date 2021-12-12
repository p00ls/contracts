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
    uint64  index; // salt
    uint64  start;
    uint64  cliff;
    uint64  duration;
    IERC20  token;
    address recipient;
    uint256 amount;
  }

  mapping(bytes32 => bool)    private _airdrops;
  mapping(bytes32 => uint256) private _released;

  event Airdrop(bytes32 indexed airdrop, bool enabled);
  event TokensReleased(bytes32 indexed airdrop, bytes32 indexed leaf, IERC20 token, address recipient, uint256 amount);

  constructor(address admin) {
    _setupRole(DEFAULT_ADMIN_ROLE, admin);
  }

  function enableAirdrop(bytes32 root, bool enable) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _airdrops[root] = enable;
    emit Airdrop(root, enable);
  }

  function enabled(bytes32 root) external view returns (bool) {
    return _airdrops[root];
  }

  function released(bytes32 leaf) public view returns (uint256) {
    return _released[leaf];
  }

  function release(Schedule memory schedule, bytes32[] memory proof) public {
    // check input validity
    bytes32 leaf = hashSchedule(schedule);
    bytes32 drop = MerkleProof.processProof(proof, leaf);
    require(_airdrops[drop], "unknown airdrop");

    // compute vesting remains
    uint256 vested     = vestedAmount(schedule, uint64(block.timestamp));
    uint256 releasable = vested - released(leaf);

    if (releasable > 0) {
      _released[leaf] = vested;

      // emit notification
      emit TokensReleased(drop, leaf, schedule.token, schedule.recipient, releasable);

      // do release
      SafeERC20.safeTransfer(schedule.token, schedule.recipient, releasable);
    }
  }

  function vestedAmount(Schedule memory schedule, uint64 timestamp) public pure returns (uint256) {
    return timestamp < schedule.start + schedule.cliff
    ? 0
    : schedule.duration == 0
    ? schedule.amount
    : Math.min(
        schedule.amount,
        schedule.amount * (timestamp - schedule.start) / schedule.duration
      );
  }

  function hashSchedule(Schedule memory schedule) public pure returns (bytes32) {
    return keccak256(abi.encodePacked(
      schedule.index,
      schedule.start,
      schedule.cliff,
      schedule.duration,
      schedule.token,
      schedule.recipient,
      schedule.amount
    ));
  }
}