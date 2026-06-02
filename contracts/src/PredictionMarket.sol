// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IGoodDollar.sol";
import "./lib/LMSR.sol";
import "./ConditionalTokens.sol";

/// @title PredictionMarket
/// @notice LMSR AMM prediction market collateralised in G$ (GoodDollar)
/// @dev Deployed by MarketFactory via minimal proxy (Clones)
contract PredictionMarket is ReentrancyGuard {
    using SafeERC20 for IGoodDollar;
    using LMSR for *;

    // ─── Constants ────────────────────────────────────────────────────────────
    uint8 public constant NO  = 0;
    uint8 public constant YES = 1;

    // ─── Immutable config (set once on initialize) ─────────────────────────
    IGoodDollar         public gDollar;
    IGoodDollarIdentity public identity;
    ConditionalTokens   public tokens;

    address  public oracle;           // admin wallet that resolves
    string   public question;
    string   public category;
    uint256  public endTime;          // unix timestamp — trading closes
    uint256  public liquidityParam;   // LMSR b parameter (WAD)
    uint256  public marketId;

    // external market ID if mirrored from Polymarket (0 if admin-created)
    string   public externalId;

    // ─── Mutable state ────────────────────────────────────────────────────────
    uint256 public qYes;              // total YES shares outstanding (WAD)
    uint256 public qNo;               // total NO shares outstanding (WAD)
    uint256 public totalCollateral;   // total G$ locked in contract (WAD)

    bool    public resolved;
    uint8   public winningOutcome;

    bool    private _initialized;

    // ─── Events ───────────────────────────────────────────────────────────────
    event SharesBought(
        address indexed trader,
        uint8   indexed outcome,
        uint256 sharesAmount,
        uint256 collateralPaid
    );
    event SharesSold(
        address indexed trader,
        uint8   indexed outcome,
        uint256 sharesAmount,
        uint256 collateralReceived
    );
    event MarketResolved(uint8 winningOutcome, uint256 timestamp);
    event Redeemed(address indexed trader, uint256 collateralAmount);

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOracle() {
        require(msg.sender == oracle, "PM: not oracle");
        _;
    }

    modifier onlyVerified() {
        require(identity.isWhitelisted(msg.sender), "PM: not GoodDollar verified");
        _;
    }

    modifier tradingOpen() {
        require(!resolved, "PM: resolved");
        require(block.timestamp < endTime, "PM: trading closed");
        _;
    }

    modifier onlyResolved() {
        require(resolved, "PM: not resolved");
        _;
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    /// @notice Called once by MarketFactory after clone deployment
    function initialize(
        uint256 _marketId,
        string  memory _question,
        string  memory _category,
        string  memory _externalId,
        uint256 _endTime,
        uint256 _liquidityParam,
        address _gDollar,
        address _identity,
        address _oracle
    ) external {
        require(!_initialized, "PM: already initialized");
        _initialized = true;

        marketId       = _marketId;
        question       = _question;
        category       = _category;
        externalId     = _externalId;
        endTime        = _endTime;
        liquidityParam = _liquidityParam;
        gDollar        = IGoodDollar(_gDollar);
        identity       = IGoodDollarIdentity(_identity);
        oracle         = _oracle;

        // deploy outcome share tokens
        tokens = new ConditionalTokens(_question, address(this));

        // seed LMSR with equal shares so initial price = 0.5
        // cost(b, b, b) - cost(0, 0, b) = the subsidy the factory must cover
        qYes = _liquidityParam;
        qNo  = _liquidityParam;
    }

    // ─── Trading ──────────────────────────────────────────────────────────────

    /// @notice Buy outcome shares
    /// @param outcome  0=NO, 1=YES
    /// @param maxCost  Max G$ caller is willing to pay (slippage guard, WAD)
    /// @param shares   Exact number of shares to buy (WAD)
    function buy(
        uint8   outcome,
        uint256 shares,
        uint256 maxCost
    ) external nonReentrant onlyVerified tradingOpen {
        require(outcome == NO || outcome == YES, "PM: invalid outcome");
        require(shares > 0, "PM: zero shares");

        uint256 qYesBefore = qYes;
        uint256 qNoBefore  = qNo;

        if (outcome == YES) {
            qYes += shares;
        } else {
            qNo  += shares;
        }

        uint256 cost = LMSR.tradeCost(qYesBefore, qNoBefore, qYes, qNo, liquidityParam);
        require(cost <= maxCost, "PM: slippage exceeded");

        totalCollateral += cost;

        gDollar.safeTransferFrom(msg.sender, address(this), cost);
        tokens.mint(msg.sender, outcome, shares);

        emit SharesBought(msg.sender, outcome, shares, cost);
    }

    /// @notice Sell outcome shares back to the AMM
    /// @param outcome   0=NO, 1=YES
    /// @param shares    Exact number of shares to sell (WAD)
    /// @param minReturn Min G$ to receive (slippage guard, WAD)
    function sell(
        uint8   outcome,
        uint256 shares,
        uint256 minReturn
    ) external nonReentrant onlyVerified tradingOpen {
        require(outcome == NO || outcome == YES, "PM: invalid outcome");
        require(shares > 0, "PM: zero shares");
        require(
            tokens.balanceOf(msg.sender, outcome) >= shares,
            "PM: insufficient shares"
        );

        uint256 qYesBefore = qYes;
        uint256 qNoBefore  = qNo;

        if (outcome == YES) {
            qYes -= shares;
        } else {
            qNo  -= shares;
        }

        // selling = negative trade cost = collateral returned
        uint256 costBefore = LMSR.cost(qYesBefore, qNoBefore, liquidityParam);
        uint256 costAfter  = LMSR.cost(qYes, qNo, liquidityParam);
        uint256 returned   = costBefore - costAfter;

        require(returned >= minReturn, "PM: slippage exceeded");
        require(returned <= totalCollateral, "PM: insufficient collateral");

        totalCollateral -= returned;

        tokens.burn(msg.sender, outcome, shares);
        gDollar.safeTransfer(msg.sender, returned);

        emit SharesSold(msg.sender, outcome, shares, returned);
    }

    // ─── Resolution ───────────────────────────────────────────────────────────

    /// @notice Resolve the market. Called by oracle after endTime.
    /// @param outcome  0=NO wins, 1=YES wins
    function resolve(uint8 outcome) external onlyOracle {
        require(!resolved, "PM: already resolved");
        require(block.timestamp >= endTime, "PM: too early");
        require(outcome == NO || outcome == YES, "PM: invalid outcome");

        resolved       = true;
        winningOutcome = outcome;

        emit MarketResolved(outcome, block.timestamp);
    }

    /// @notice Redeem winning shares for G$
    function redeem() external nonReentrant onlyResolved {
        uint256 winningShares = tokens.balanceOf(msg.sender, winningOutcome);
        require(winningShares > 0, "PM: no winning shares");

        uint256 totalWinningShares = (winningOutcome == YES) ? qYes : qNo;
        require(totalWinningShares > 0, "PM: no winning shares exist");

        // proportional payout: user's share of total winning pool
        uint256 payout = (winningShares * totalCollateral) / totalWinningShares;

        tokens.burn(msg.sender, winningOutcome, winningShares);
        gDollar.safeTransfer(msg.sender, payout);

        emit Redeemed(msg.sender, payout);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function priceYes() external view returns (uint256) {
        return LMSR.priceYes(qYes, qNo, liquidityParam);
    }

    function priceNo() external view returns (uint256) {
        return LMSR.priceNo(qYes, qNo, liquidityParam);
    }

    function getBuyQuote(uint8 outcome, uint256 shares) external view returns (uint256 cost) {
        uint256 qYesAfter = outcome == YES ? qYes + shares : qYes;
        uint256 qNoAfter  = outcome == NO  ? qNo  + shares : qNo;
        cost = LMSR.tradeCost(qYes, qNo, qYesAfter, qNoAfter, liquidityParam);
    }

    function getSellQuote(uint8 outcome, uint256 shares) external view returns (uint256 returned) {
        uint256 qYesAfter = outcome == YES ? qYes - shares : qYes;
        uint256 qNoAfter  = outcome == NO  ? qNo  - shares : qNo;
        uint256 costBefore = LMSR.cost(qYes, qNo, liquidityParam);
        uint256 costAfter  = LMSR.cost(qYesAfter, qNoAfter, liquidityParam);
        returned = costBefore - costAfter;
    }

    function getMarketInfo() external view returns (
        string memory _question,
        string memory _category,
        string memory _externalId,
        uint256 _endTime,
        uint256 _qYes,
        uint256 _qNo,
        uint256 _totalCollateral,
        bool    _resolved,
        uint8   _winningOutcome
    ) {
        return (
            question, category, externalId,
            endTime, qYes, qNo,
            totalCollateral, resolved, winningOutcome
        );
    }
}