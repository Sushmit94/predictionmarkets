// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MarketFactory.sol";

contract MockGDollar2 is ERC20 {
    constructor() ERC20("GoodDollar", "G$") {}
}
contract MockIdentity2 {
    function isWhitelisted(address) external pure returns (bool) { return true; }
}

contract MarketFactoryTest is Test {
    MarketFactory factory;

    function setUp() public {
        factory = new MarketFactory(
            address(new MockGDollar2()),
            address(new MockIdentity2()),
            address(0xBEEF)
        );
    }

    function test_CreateMarket() public {
        (uint256 id, address addr) = factory.createMarket(
            "Test question?", "test", "poly_123",
            block.timestamp + 1 days, 0
        );
        assertEq(id, 1);
        assertEq(factory.getMarket(1), addr);
        assertEq(factory.getMarketByExternalId("poly_123"), addr);
    }

    function test_NoDuplicateExternalId() public {
        factory.createMarket("Q1?", "test", "poly_123", block.timestamp + 1 days, 0);

        vm.expectRevert("Factory: market already mirrored");
        factory.createMarket("Q2?", "test", "poly_123", block.timestamp + 2 days, 0);
    }

    function test_GetAllMarkets() public {
        factory.createMarket("Q1?", "a", "", block.timestamp + 1 days, 0);
        factory.createMarket("Q2?", "b", "", block.timestamp + 2 days, 0);

        address[] memory all = factory.getAllMarkets();
        assertEq(all.length, 2);
    }
}