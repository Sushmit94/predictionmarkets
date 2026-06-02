// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice ERC-1155 outcome share tokens
/// Token ID 0 = NO shares, Token ID 1 = YES shares
/// Each market has its own ConditionalTokens instance (deployed by PredictionMarket)
contract ConditionalTokens is ERC1155, Ownable {
    uint8 public constant NO  = 0;
    uint8 public constant YES = 1;

    string public marketQuestion;

    constructor(string memory question, address market)
        ERC1155("")
        Ownable(market)
    {
        marketQuestion = question;
    }

    /// @notice Mint outcome shares — only callable by the PredictionMarket contract
    function mint(address to, uint8 outcome, uint256 amount) external onlyOwner {
        _mint(to, outcome, amount, "");
    }

    /// @notice Burn outcome shares — only callable by the PredictionMarket contract
    function burn(address from, uint8 outcome, uint256 amount) external onlyOwner {
        _burn(from, outcome, amount);
    }

    function uri(uint256 id) public view override returns (string memory) {
        return id == YES ? "yes" : "no";
    }
}