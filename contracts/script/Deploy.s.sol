// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";

contract Deploy is Script {
    // G$ on Celo mainnet
   address constant G_DOLLAR = 0x62B8b11039fcfe5Ab0c56E502B1c372a3d2a9C14;

    // GoodDollar Identity contract on Celo mainnet
    // verify latest address at https://docs.gooddollar.org
    address constant IDENTITY  = 0xc361A6e66093BC6FB7dD925244354011E4911Ac9;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address oracle      = vm.envAddress("ORACLE_ADDRESS");

        vm.startBroadcast(deployerKey);

        MarketFactory factory = new MarketFactory(G_DOLLAR, IDENTITY, oracle);

        console.log("MarketFactory deployed at:", address(factory));
        console.log("PredictionMarket implementation:", factory.implementation());

        vm.stopBroadcast();
    }
}