// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FHECryptoSeer - Encrypted Crypto Prediction Contract
/// @notice Users can privately predict which crypto project will succeed most in 2025.
contract FHECryptoSeer is ZamaEthereumConfig {
    mapping(address => euint32) private _encryptedPredictions;
    mapping(address => bool) private _hasPredicted;

    /// @notice Submit an encrypted prediction for 2025's most successful crypto project.
    /// @param inputEuint32 Encrypted project ID (1–6)
    /// @param inputProof FHE input proof
    function predict(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        require(!_hasPredicted[msg.sender], "Already predicted");

        euint32 encryptedPrediction = FHE.fromExternal(inputEuint32, inputProof);
        _encryptedPredictions[msg.sender] = encryptedPrediction;
        _hasPredicted[msg.sender] = true;

        FHE.allowThis(encryptedPrediction);
        FHE.allow(encryptedPrediction, msg.sender);
    }

    /// @notice Update an existing encrypted prediction.
    function updatePrediction(externalEuint32 inputEuint32, bytes calldata inputProof) external {
        require(_hasPredicted[msg.sender], "No prediction found");

        euint32 encryptedPrediction = FHE.fromExternal(inputEuint32, inputProof);
        _encryptedPredictions[msg.sender] = encryptedPrediction;

        FHE.allowThis(encryptedPrediction);
        FHE.allow(encryptedPrediction, msg.sender);
    }

    /// @notice Get encrypted prediction for caller
    function getMyPrediction() external view returns (euint32) {
        return _encryptedPredictions[msg.sender];
    }

    /// @notice Get encrypted prediction for any user (still encrypted)
    function getUserPrediction(address user) external view returns (euint32) {
        return _encryptedPredictions[user];
    }

    /// @notice Check if a user has predicted
    function hasPredicted(address user) external view returns (bool) {
        return _hasPredicted[user];
    }
}
