// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal interface for G$ on Celo
/// G$ Celo mainnet address: 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
interface IGoodDollar is IERC20 {
    function identity() external view returns (address);
}

/// @notice GoodDollar Identity contract — sybil resistance
interface IGoodDollarIdentity {
    function isWhitelisted(address account) external view returns (bool);
}
