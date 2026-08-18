// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {DeployMulkChain} from "./DeployMulkChain.s.sol";

/// @notice Alias for testnet / CI commands that expect `DeployAll`.
contract DeployAll is DeployMulkChain {}
