pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

// Merkle tree membership proof
// Proves: "I know a secret whose Poseidon hash is a leaf in the Merkle tree"
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    signal output root;

    component hashers[levels];
    component mux[levels];

    signal hashes[levels + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        mux[i] = Mux1();
        mux[i].c[0] <== hashes[i];
        mux[i].c[1] <== pathElements[i];
        mux[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out;
        hashers[i].inputs[1] <== hashes[i] + pathElements[i] - mux[i].out;

        hashes[i + 1] <== hashers[i].out;
    }

    root <== hashes[levels];
}

// Whistleblower ZKP: proves registered user membership without revealing identity
template WhistleblowerProof(levels) {
    // Private inputs
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Public inputs
    signal input merkleRoot;
    signal input nullifierHash;

    // Step 1: Compute commitment = Poseidon(secret)
    component commitHasher = Poseidon(1);
    commitHasher.inputs[0] <== secret;
    signal commitment;
    commitment <== commitHasher.out;

    // Step 2: Verify Merkle membership
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitment;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Step 3: Constrain root matches public input
    merkleRoot === tree.root;

    // Step 4: Verify nullifier
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== secret;
    nullifierHash === nullifierHasher.out;
}

// 8 levels = 256 users max (sufficient for thesis prototype)
component main {public [merkleRoot, nullifierHash]} = WhistleblowerProof(8);
