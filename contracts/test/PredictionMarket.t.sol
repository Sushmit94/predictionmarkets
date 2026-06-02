// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MarketFactory.sol";
import "../src/PredictionMarket.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock G$ token for testing
contract MockGDollar is ERC20 {
    constructor() ERC20("GoodDollar", "G$") {
        _mint(msg.sender, 1_000_000e18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Mock identity — everyone is whitelisted
contract MockIdentity {
    function isWhitelisted(address) external pure returns (bool) {
        return true;
    }
}

contract PredictionMarketTest is Test {
    MarketFactory   factory;
    MockGDollar     gDollar;
    MockIdentity    identity;
    PredictionMarket market;

    address owner   = address(this);
    address oracle  = address(0xBEEF);
    address trader1 = address(0xA1);
    address trader2 = address(0xA2);

    uint256 END_TIME;
    uint256 constant LIQUIDITY = 100e18;

    function setUp() public {
        gDollar  = new MockGDollar();
        identity = new MockIdentity();
        factory  = new MarketFactory(address(gDollar), address(identity), oracle);

        END_TIME = block.timestamp + 7 days;

        (, address marketAddr) = factory.createMarket(
            "Will ETH price exceed $5000 by end of month?",
            "crypto",
            "",
            END_TIME,
            LIQUIDITY
        );

        market = PredictionMarket(marketAddr);

        // fund traders
        gDollar.mint(trader1, 10_000e18);
        gDollar.mint(trader2, 10_000e18);

        vm.prank(trader1);
        gDollar.approve(address(market), type(uint256).max);

        vm.prank(trader2);
        gDollar.approve(address(market), type(uint256).max);
    }

    function test_InitialPricesEqual() public view {
        uint256 pYes = market.priceYes();
        uint256 pNo  = market.priceNo();
        // both should be ~0.5e18
        assertApproxEqAbs(pYes, 0.5e18, 1e15);
        assertApproxEqAbs(pNo,  0.5e18, 1e15);
        assertApproxEqAbs(pYes + pNo, 1e18, 1e12);
    }

    function test_BuyYes() public {
        uint256 shares  = 10e18;
        uint256 quote   = market.getBuyQuote(1, shares);
        uint256 balBefore = gDollar.balanceOf(trader1);

        vm.prank(trader1);
        market.buy(1, shares, quote + 1e18); // +1 G$ slippage tolerance

        assertEq(gDollar.balanceOf(trader1), balBefore - quote);
        assertEq(market.tokens().balanceOf(trader1, 1), shares);
    }

    function test_BuyShiftsPriceUp() public {
        uint256 priceYesBefore = market.priceYes();

        vm.prank(trader1);
        market.buy(1, 50e18, type(uint256).max);

        uint256 priceYesAfter = market.priceYes();
        assertGt(priceYesAfter, priceYesBefore);
    }

    function test_SellReturnsCollateral() public {
        uint256 shares = 10e18;

        vm.prank(trader1);
        market.buy(1, shares, type(uint256).max);

        uint256 balAfterBuy = gDollar.balanceOf(trader1);
        uint256 sellQuote   = market.getSellQuote(1, shares);

        vm.prank(trader1);
        market.sell(1, shares, sellQuote - 1e15);

        assertApproxEqAbs(
            gDollar.balanceOf(trader1),
            balAfterBuy + sellQuote,
            1e15 // rounding tolerance
        );
    }

    function test_ResolveAndRedeem() public {
        // trader1 buys YES, trader2 buys NO
        vm.prank(trader1);
        market.buy(1, 20e18, type(uint256).max);

        vm.prank(trader2);
        market.buy(0, 20e18, type(uint256).max);

        // warp past end time and resolve YES
        vm.warp(END_TIME + 1);
        vm.prank(oracle);
        market.resolve(1);

        assertTrue(market.resolved());
        assertEq(market.winningOutcome(), 1);

        uint256 balBefore = gDollar.balanceOf(trader1);

        vm.prank(trader1);
        market.redeem();

        assertGt(gDollar.balanceOf(trader1), balBefore);
    }

    function test_RevertIf_ResolveTooEarly() public {
        vm.prank(oracle);
        vm.expectRevert("PM: too early");
        market.resolve(1);
    }

    function test_RevertIf_SlippageExceeded() public {
        uint256 quote = market.getBuyQuote(1, 50e18);

        vm.prank(trader1);
        vm.expectRevert("PM: slippage exceeded");
        market.buy(1, 50e18, quote - 1); // maxCost less than actual cost
    }

    function test_RevertIf_TradingAfterEnd() public {
        vm.warp(END_TIME + 1);

        vm.prank(trader1);
        vm.expectRevert("PM: trading closed");
        market.buy(1, 10e18, type(uint256).max);
    }

    function test_PricesAlwaysSumToOne() public {
        vm.prank(trader1);
        market.buy(1, 30e18, type(uint256).max);

        vm.prank(trader2);
        market.buy(0, 40e18, type(uint256).max);

        uint256 sum = market.priceYes() + market.priceNo();
        assertApproxEqAbs(sum, 1e18, 1e12);
    }
}