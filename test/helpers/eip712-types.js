const { mapValues } = require('./iterate');

const formatType = schema => Object.entries(schema).map(([name, type]) => ({ name, type }));

module.exports = mapValues(
  {
    EIP712Domain: {
      name: 'string',
      version: 'string',
      chainId: 'uint256',
      verifyingContract: 'address',
      salt: 'bytes32',
    },
    CreateToken: {
      owner: 'address',
      name: 'string',
      symbol: 'string',
      root: 'bytes32',
      fees: 'bytes32',
    },
    Distribution: {
      owner: 'address',
      allocations: 'Allocation[]',
      nonce: 'uint256',
    },
    Allocation: {
      token: 'address',
      recipient: 'address',
      amount: 'uint256',
    },
  },
  formatType,
);
module.exports.formatType = formatType;
