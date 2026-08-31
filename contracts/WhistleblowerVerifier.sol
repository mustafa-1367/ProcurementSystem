// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Groth16Verifier.sol";

/// @title WhistleblowerVerifier — On-chain ZKP verification for anonymous reports
/// Anyone can register a commitment and submit a ZKP-verified report.
/// Security relies on Groth16 proof verification, not access control.
contract WhistleblowerVerifier {
    Groth16Verifier public immutable verifier;
    address public owner;

    bytes32 public currentMerkleRoot;
    mapping(bytes32 => bool) public usedNullifiers;
    mapping(uint256 => bool) public registeredCommitments;
    uint256[] public commitments;

    event UserRegistered(uint256 indexed commitment, uint256 leafIndex);
    event MerkleRootUpdated(bytes32 newRoot);
    event ReportSubmitted(bytes32 indexed reportId, bytes32 nullifierHash, string category, string severity, bool proofValid);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _verifier) {
        verifier = Groth16Verifier(_verifier);
        owner = msg.sender;
    }

    /// @notice Anyone can register a Poseidon commitment (one per identity)
    function registerCommitment(uint256 commitment) external {
        require(!registeredCommitments[commitment], "Commitment already registered");
        registeredCommitments[commitment] = true;
        commitments.push(commitment);
        emit UserRegistered(commitment, commitments.length - 1);
    }

    /// @notice Owner can update the merkle root (for batch updates)
    function updateMerkleRoot(bytes32 newRoot) external onlyOwner {
        currentMerkleRoot = newRoot;
        emit MerkleRootUpdated(newRoot);
    }

    /// @notice Submit a report with full Groth16 proof for on-chain verification.
    /// Updates the merkle root atomically so any user can submit without owner help.
    function submitVerifiedReport(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint256 merkleRoot,
        uint256 nullifierHash,
        string calldata category,
        string calldata severity
    ) external returns (bytes32 reportId) {
        // Set merkle root atomically — proof is verified against this root
        currentMerkleRoot = bytes32(merkleRoot);

        bytes32 nullifierBytes = bytes32(nullifierHash);
        require(!usedNullifiers[nullifierBytes], "Proof already used");

        uint[2] memory pubInputs = [merkleRoot, nullifierHash];
        bool valid = verifier.verifyProof(_pA, _pB, _pC, pubInputs);
        require(valid, "Invalid ZK proof");

        usedNullifiers[nullifierBytes] = true;
        reportId = keccak256(abi.encodePacked(nullifierBytes, block.timestamp));

        emit ReportSubmitted(reportId, nullifierBytes, category, severity, true);
    }

    function getCommitmentCount() external view returns (uint256) {
        return commitments.length;
    }

    function getCommitment(uint256 index) external view returns (uint256) {
        return commitments[index];
    }
}
