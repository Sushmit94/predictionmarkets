// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PredictionMarket.sol";

/// @title MarketFactory
/// @notice Deploys minimal proxy clones of PredictionMarket
contract MarketFactory is Ownable {
    using Clones for address;

    // ─── Config ───────────────────────────────────────────────────────────────
    address public immutable implementation;  // PredictionMarket logic contract
    address public immutable gDollar;
    address public immutable identity;
    address public oracle;                    // can be updated by owner

    /// @notice Default LMSR b param — tune based on desired liquidity depth
    /// 1000e18 means ~$1000 G$ subsidy needed to seed equal prices
    uint256 public defaultLiquidityParam = 1_000e18;

    // ─── Registry ─────────────────────────────────────────────────────────────
    uint256 public marketCount;
    mapping(uint256 => address) public markets;          // marketId => proxy address
    mapping(string  => uint256) public externalIdToMarket; // polymarket ID => marketId

    // ─── Events ───────────────────────────────────────────────────────────────
    event MarketCreated(
        uint256 indexed marketId,
        address indexed marketAddress,
        string  question,
        string  category,
        string  externalId,
        uint256 endTime
    );
    event OracleUpdated(address newOracle);
    event LiquidityParamUpdated(uint256 newParam);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(
        address _gDollar,
        address _identity,
        address _oracle
    ) Ownable(msg.sender) {
        gDollar    = _gDollar;
        identity   = _identity;
        oracle     = _oracle;

        // deploy implementation once — all clones delegate to this
        implementation = address(new PredictionMarket());
    }

    // ─── Market creation ──────────────────────────────────────────────────────

    /// @notice Create a new prediction market
    /// @param question      The question being predicted
    /// @param category      e.g. "crypto", "politics", "gooddollar"
    /// @param externalId    Polymarket market ID if mirrored, else ""
    /// @param endTime       Unix timestamp when trading closes
    /// @param liquidityParam LMSR b — 0 uses defaultLiquidityParam
    function createMarket(
        string memory question,
        string memory category,
        string memory externalId,
        uint256 endTime,
        uint256 liquidityParam
    ) external onlyOwner returns (uint256 marketId, address marketAddress) {
        require(endTime > block.timestamp, "Factory: end time in past");

        // prevent duplicate Polymarket mirrors
        if (bytes(externalId).length > 0) {
            require(externalIdToMarket[externalId] == 0, "Factory: market already mirrored");
        }

        uint256 b = liquidityParam == 0 ? defaultLiquidityParam : liquidityParam;

        marketId      = ++marketCount;
        marketAddress = implementation.clone();

        PredictionMarket(marketAddress).initialize(
            marketId,
            question,
            category,
            externalId,
            endTime,
            b,
            gDollar,
            identity,
            oracle
        );

        markets[marketId] = marketAddress;

        if (bytes(externalId).length > 0) {
            externalIdToMarket[externalId] = marketId;
        }

        emit MarketCreated(marketId, marketAddress, question, category, externalId, endTime);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Factory: zero address");
        oracle = _oracle;
        emit OracleUpdated(_oracle);
    }

    function setDefaultLiquidityParam(uint256 _param) external onlyOwner {
        require(_param > 0, "Factory: zero param");
        defaultLiquidityParam = _param;
        emit LiquidityParamUpdated(_param);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getMarket(uint256 marketId) external view returns (address) {
        return markets[marketId];
    }

    function getMarketByExternalId(string memory externalId) external view returns (address) {
        return markets[externalIdToMarket[externalId]];
    }

    function getAllMarkets() external view returns (address[] memory) {
        address[] memory result = new address[](marketCount);
        for (uint256 i = 1; i <= marketCount; i++) {
            result[i - 1] = markets[i];
        }
        return result;
    }
}