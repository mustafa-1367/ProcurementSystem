// ZKP Proof generation utility — uses snarkjs + circomlibjs in the browser
// Generates Groth16 proofs for whistleblower anonymous identity membership

import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';

let poseidon: any = null;

async function getPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
  }
  return poseidon;
}

export interface ZKProofResult {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };
  publicSignals: string[];
  nullifierHash: string;
  merkleRoot: string;
}

/** Generate a random secret for a new user (31 bytes to stay within BN254 field) */
export function generateUserSecret(): bigint {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let hex = '0x';
  bytes.forEach(b => hex += b.toString(16).padStart(2, '0'));
  return BigInt(hex);
}

/** Compute Poseidon commitment for a secret */
export async function computeCommitment(secret: bigint): Promise<bigint> {
  const p = await getPoseidon();
  const hash = p([secret]);
  return p.F.toObject(hash);
}

/** Compute nullifier hash: Poseidon(secret, secret) */
export async function computeNullifier(secret: bigint): Promise<bigint> {
  const p = await getPoseidon();
  const hash = p([secret, secret]);
  return p.F.toObject(hash);
}

/** Build a Merkle tree from commitments and return root + proof for a leaf */
export async function buildMerkleTree(
  commitments: bigint[],
  leafIndex: number,
  levels: number = 8
): Promise<{ root: bigint; pathElements: bigint[]; pathIndices: number[] }> {
  const p = await getPoseidon();
  const F = p.F;

  const treeSize = 2 ** levels;
  const leaves: bigint[] = new Array(treeSize).fill(BigInt(0));
  for (let i = 0; i < commitments.length; i++) {
    leaves[i] = commitments[i];
  }

  let currentLevel = [...leaves];
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  let currentIndex = leafIndex;

  for (let level = 0; level < levels; level++) {
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    pathElements.push(currentLevel[siblingIndex]);
    pathIndices.push(currentIndex % 2);

    const nextLevel: bigint[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const hash = p([currentLevel[i], currentLevel[i + 1]]);
      nextLevel.push(F.toObject(hash));
    }

    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return { root: currentLevel[0], pathElements, pathIndices };
}

/** Generate a Groth16 proof in the browser */
export async function generateProof(
  secret: bigint,
  commitments: bigint[],
  leafIndex: number
): Promise<ZKProofResult> {
  const { root, pathElements, pathIndices } = await buildMerkleTree(commitments, leafIndex);
  const nullifierHash = await computeNullifier(secret);

  const input = {
    secret: secret.toString(),
    pathElements: pathElements.map(e => e.toString()),
    pathIndices,
    merkleRoot: root.toString(),
    nullifierHash: nullifierHash.toString(),
  };

  const basePath = import.meta.env.BASE_URL || '/';
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    `${basePath}zkp/whistleblower.wasm`,
    `${basePath}zkp/whistleblower_final.zkey`
  );

  return {
    proof,
    publicSignals,
    nullifierHash: nullifierHash.toString(),
    merkleRoot: root.toString(),
  };
}

/** Format proof for Solidity contract call */
export function formatProofForContract(proof: any) {
  return {
    pA: [proof.pi_a[0], proof.pi_a[1]] as [string, string],
    pB: [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ] as [[string, string], [string, string]],
    pC: [proof.pi_c[0], proof.pi_c[1]] as [string, string],
  };
}
