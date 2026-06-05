// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";

contract Deploy is Script {
    // Production G$ on Celo mainnet.
    address constant CELO_G_DOLLAR = 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A;

    // Production GoodDollar Identity contract on Celo mainnet.
    address constant CELO_IDENTITY = 0xC361A6E67822a0EDc17D899227dd9FC50BD62F42;

    // Development G$ and Identity contracts on Celo mainnet.
    // Useful for buildathon demos with dev.gooddapp.org and dev-goodcollective.
    address constant CELO_DEV_G_DOLLAR = 0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475;
    address constant CELO_DEV_IDENTITY = 0xF25fA0D4896271228193E782831F6f3CFCcF169C;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address oracle      = vm.envAddress("ORACLE_ADDRESS");
        bool useDevContracts = vm.envOr("USE_GOODDOLLAR_DEV_CONTRACTS", false);

        address gDollar = useDevContracts ? CELO_DEV_G_DOLLAR : CELO_G_DOLLAR;
        address identity = useDevContracts ? CELO_DEV_IDENTITY : CELO_IDENTITY;

        vm.startBroadcast(deployerKey);

        MarketFactory factory = new MarketFactory(gDollar, identity, oracle);

        console.log("MarketFactory deployed at:", address(factory));
        console.log("PredictionMarket implementation:", factory.implementation());
        console.log("G$ token:", gDollar);
        console.log("GoodDollar identity:", identity);
        console.log("Using dev contracts:", useDevContracts);

        vm.stopBroadcast();
    }
}
