// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SD59x18, sd, unwrap, exp, ln } from "prb-math/SD59x18.sol";

/// @notice Logarithmic Market Scoring Rule (LMSR) pricing library
/// @dev All amounts are in 18-decimal fixed point (WAD)
library LMSR {
    /// @notice Compute LMSR cost function C(q) = b * ln(sum(exp(q_i / b)))
    /// @param qYes  Current YES shares outstanding (WAD)
    /// @param qNo   Current NO shares outstanding (WAD)
    /// @param b     Liquidity parameter (WAD) — higher b = more liquidity, more subsidy needed
    function cost(
        uint256 qYes,
        uint256 qNo,
        uint256 b
    ) internal pure returns (uint256) {
        SD59x18 bFixed = sd(int256(b));
        SD59x18 expYes = exp(sd(int256(qYes)).div(bFixed));
        SD59x18 expNo  = exp(sd(int256(qNo)).div(bFixed));
        SD59x18 result = bFixed.mul(ln(expYes.add(expNo)));
        return uint256(unwrap(result));
    }

    /// @notice Cost of a trade: C(q_after) - C(q_before)
    /// @param qYesBefore  YES shares before trade
    /// @param qNoBefore   NO shares before trade
    /// @param qYesAfter   YES shares after trade
    /// @param qNoAfter    NO shares after trade
    /// @param b           Liquidity parameter
    function tradeCost(
        uint256 qYesBefore,
        uint256 qNoBefore,
        uint256 qYesAfter,
        uint256 qNoAfter,
        uint256 b
    ) internal pure returns (uint256) {
        uint256 costAfter  = cost(qYesAfter,  qNoAfter,  b);
        uint256 costBefore = cost(qYesBefore, qNoBefore, b);
        require(costAfter >= costBefore, "LMSR: negative trade cost");
        return costAfter - costBefore;
    }

    /// @notice Marginal price of YES outcome ∈ (0, 1e18)
    /// price_yes = exp(qYes/b) / (exp(qYes/b) + exp(qNo/b))
    function priceYes(
        uint256 qYes,
        uint256 qNo,
        uint256 b
    ) internal pure returns (uint256) {
        SD59x18 bFixed = sd(int256(b));
        SD59x18 expYes = exp(sd(int256(qYes)).div(bFixed));
        SD59x18 expNo  = exp(sd(int256(qNo)).div(bFixed));
        SD59x18 p = expYes.div(expYes.add(expNo));
        return uint256(unwrap(p));
    }

    /// @notice Marginal price of NO outcome = 1 - priceYes
    function priceNo(
        uint256 qYes,
        uint256 qNo,
        uint256 b
    ) internal pure returns (uint256) {
        return 1e18 - priceYes(qYes, qNo, b);
    }
}