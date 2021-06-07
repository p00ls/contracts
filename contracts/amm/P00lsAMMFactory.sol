// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import './P00lsAMMPair.sol';

contract P00lsAMMFactory is Ownable {
    address public immutable template;
    address public feeTo;
    uint256 public delay;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    constructor(address _admin) {
        transferOwnership(_admin);
        template = address(new P00lsAMMPair());
    }

    function allPairsLength() external view returns (uint) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, 'UniswapV2: IDENTICAL_ADDRESSES');
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'UniswapV2: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'UniswapV2: PAIR_EXISTS'); // single check is sufficient
        pair = Clones.cloneDeterministic(template, keccak256(abi.encodePacked(token0, token1)));
        P00lsAMMPair(pair).initialize(token0, token1, block.timestamp + delay);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external onlyOwner() {
        feeTo = _feeTo;
    }

    function setDelay(uint256 _delay) external onlyOwner() {
        delay = _delay;
    }
}
