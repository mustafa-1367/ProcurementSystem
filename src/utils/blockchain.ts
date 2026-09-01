// Blockchain Service — Connects to real Ethereum testnet (Hardhat/Sepolia) via MetaMask,
// with in-memory simulation fallback when wallet is not connected.

import { getWeb3State } from './web3Provider';
import { id as keccak256, parseUnits, formatUnits } from 'ethers';
import type { Contract } from 'ethers';

export interface Block {
  index: number;
  timestamp: number;
  data: any;
  previousHash: string;
  hash: string;
  nonce: number;
}

export type ContractType = 'tender' | 'bid' | 'award' | 'payment' | 'dispute' | 'dao_resolution' | 'whistleblower_report' | 'whistleblower_referral' | 'dispute_complaint' | 'evaluation_rereview' | 'objection' | 'supplier_registration' | 'bid_submission';

export interface SmartContract {
  id: string;
  type: ContractType;
  status: 'pending' | 'executed' | 'failed';
  data: any;
  timestamp: number;
  transactionHash: string;
}

export interface ProcurementRecordResult {
  block: Block;
  contract: SmartContract;
  success: boolean;
  onChain: boolean; // true = real blockchain tx, false = simulation fallback
}

// ═══════════════════════════════════════════════════════════════════════
// On-chain operations — call real smart contracts via MetaMask
// ═══════════════════════════════════════════════════════════════════════

// Cache mapping local tender IDs to on-chain tender IDs
const onChainTenderIdCache: Record<string, string> = {};

async function onChainTender(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const title = String(data.title || '');
  const budget = BigInt(Number(String(data.budget).replace(/,/g, '')) || 0);
  const deadline = BigInt(Math.floor(new Date(String(data.deadline)).getTime() / 1000));
  const tx = await procContract.createTender(title, budget, deadline);
  const receipt = await tx.wait();

  // Extract on-chain tender ID from event and cache it
  const event = receipt.logs?.find((log: any) => {
    try { return procContract.interface.parseLog(log)?.name === 'TenderCreated'; } catch { return false; }
  });
  if (event && data.localTenderId) {
    const onChainId = procContract.interface.parseLog(event)?.args?.[0];
    if (onChainId) {
      onChainTenderIdCache[data.localTenderId as string] = onChainId;
      console.log('[Blockchain] Cached on-chain tender ID for', data.localTenderId);
    }
  }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}

async function onChainPublishTender(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  // Use cached on-chain ID if available, otherwise fall back to keccak hash
  const localId = data.tenderId as string;
  const tenderId = onChainTenderIdCache[localId] || keccak256(localId);
  const tx = await procContract.publishTender(tenderId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}

async function onChainBid(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const localTenderId = data.tenderId as string;
  const amount = BigInt(Number(String(data.amount).replace(/,/g, '')) || 0);

  // Check if we already have the on-chain tender ID cached
  const cachedId = onChainTenderIdCache[localTenderId];
  if (cachedId) {
    console.log('[Blockchain] Using cached on-chain tender ID for', localTenderId);
    const tx = await procContract.submitBid(cachedId, amount);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
  }

  // No cached ID — try with keccak hash first, then create if needed
  const hashedId = keccak256(localTenderId);
  try {
    const tx = await procContract.submitBid(hashedId, amount);
    const receipt = await tx.wait();
    onChainTenderIdCache[localTenderId] = hashedId;
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
  } catch (bidErr: any) {
    if (bidErr?.reason === 'Tender not published' || bidErr?.reason === 'Tender does not exist') {
      console.log('[Blockchain] Tender not on-chain yet, creating & publishing first...');
      const title = String(data.vendor || localTenderId || '');
      const budget = BigInt(Number(String(data.amount).replace(/,/g, '')) || 0);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30);

      const createTx = await procContract.createTender(title, budget, deadline);
      const createReceipt = await createTx.wait();

      const tenderCreatedEvent = createReceipt.logs?.find((log: any) => {
        try { return procContract.interface.parseLog(log)?.name === 'TenderCreated'; } catch { return false; }
      });
      const onChainTenderId = tenderCreatedEvent
        ? procContract.interface.parseLog(tenderCreatedEvent)?.args?.[0]
        : hashedId;

      // Cache it for future bids
      onChainTenderIdCache[localTenderId] = onChainTenderId;

      const pubTx = await procContract.publishTender(onChainTenderId);
      await pubTx.wait();

      const tx = await procContract.submitBid(onChainTenderId, amount);
      const receipt = await tx.wait();
      return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
    }
    throw bidErr;
  }
}

async function onChainAward(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const tenderId = keccak256(data.tenderId as string);
  const bidId = data.bidId as string ? keccak256(data.bidId as string) : '0x' + '0'.repeat(64);
  const vendor = data.vendor as string || '0x' + '0'.repeat(40);
  const amount = BigInt(Number(String(data.amount).replace(/,/g, '')) || 0);
  const tx = await procContract.awardContract(tenderId, bidId, vendor, amount);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}

async function onChainPayment(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const contractId = data.contractId as string ? keccak256(data.contractId as string) : '0x' + '0'.repeat(64);
  const milestoneId = BigInt(Number(data.milestoneId) || 0);
  const amount = BigInt(Number(String(data.amount).replace(/,/g, '')) || 0);
  const tx = await procContract.recordPayment(contractId, milestoneId, amount);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}

// Cache mapping: local dispute ID (e.g. "DSP-123") → on-chain bytes32 dispute ID
const onChainDisputeIdCache: Record<string, string> = {};

async function onChainDispute(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string; onChainDisputeId?: string }> {
  const title = String(data.title || 'Dispute');
  const tx = await procContract.createDispute(title);
  const receipt = await tx.wait();

  // Extract the on-chain disputeId from the DisputeCreated event
  let onChainDisputeId: string | undefined;
  for (const log of receipt.logs) {
    try {
      const parsed = procContract.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed && parsed.name === 'DisputeCreated') {
        onChainDisputeId = parsed.args[0]; // first indexed arg is disputeId
        // Cache it with the local ID if provided
        if (data.disputeId) {
          onChainDisputeIdCache[String(data.disputeId)] = onChainDisputeId;
        }
        break;
      }
    } catch { /* skip non-matching logs */ }
  }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, onChainDisputeId };
}

async function onChainVote(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  // Look up the real on-chain dispute ID from cache
  const localId = String(data.disputeId || '');
  const onChainId = onChainDisputeIdCache[localId];
  if (!onChainId) {
    throw new Error(`No on-chain dispute ID found for ${localId}. The dispute may not have been created on-chain.`);
  }
  const approve = Boolean(data.approve);
  const tx = await procContract.castVote(onChainId, approve);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}

async function onChainWhistleblower(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const category = String(data.category || '');
  const severity = String(data.severity || '');
  const proofData = data.proofData as any;

  // If full ZKP proof data is available, use WhistleblowerVerifier for on-chain Groth16 verification
  const web3 = getWeb3State();
  if (proofData?.pA && proofData?.pB && proofData?.pC && web3.whistleblowerVerifierContract) {
    const verifier = web3.whistleblowerVerifierContract;

    // Step 1: Register the commitment on-chain (anyone can call this)
    const commitment = data.commitment as string;
    if (commitment) {
      try {
        const regTx = await verifier.registerCommitment(BigInt(commitment));
        await regTx.wait();
        console.log('[ZKP] Commitment registered on-chain');
      } catch (err: any) {
        // "Commitment already registered" is fine — means user registered before
        console.warn('[ZKP] Commitment registration skipped:', err.reason || err.message);
      }
    }

    // Step 2: Submit proof for on-chain Groth16 verification
    // The contract updates the merkle root atomically — no separate owner call needed
    const merkleRoot = proofData.merkleRoot as string;
    const pA = proofData.pA.map((x: string) => BigInt(x));
    const pB = proofData.pB.map((row: string[]) => row.map((x: string) => BigInt(x)));
    const pC = proofData.pC.map((x: string) => BigInt(x));
    const merkleRootUint = BigInt(merkleRoot);
    const nullifierHashUint = BigInt(proofData.nullifierHash as string);

    console.log('[ZKP] Submitting proof for on-chain Groth16 verification...');
    const tx = await verifier.submitVerifiedReport(
      pA, pB, pC,
      merkleRootUint,
      nullifierHashUint,
      category,
      severity
    );
    const receipt = await tx.wait();
    console.log('[ZKP] On-chain Groth16 verification PASSED — report submitted');
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
  }

  // Fallback: no proof data or no verifier contract — use ProcurementSystem hash-only method
  const zkProofRaw = data.zkProof as string || '';
  const zkProofHash = zkProofRaw.startsWith('0x') ? zkProofRaw : keccak256(zkProofRaw);
  const tx = await procContract.submitWhistleblowerReport(zkProofHash, category, severity);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}

async function onChainRegister(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const companyName = String(data.company || '');
  const tx = await procContract.registerSupplier(companyName);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}

// ═══════════════════════════════════════════════════════════════════════
// Main entry point — tries on-chain first, falls back to simulation
// ═══════════════════════════════════════════════════════════════════════

export async function addProcurementRecordAsync(
  type: ContractType,
  data: Record<string, unknown>
): Promise<ProcurementRecordResult> {
  const web3 = getWeb3State();
  console.log('[Blockchain] Web3 state:', { connected: web3.connected, isCorrectNetwork: web3.isCorrectNetwork, hasContract: !!web3.procurementContract, chainId: web3.chainId });

  // Try on-chain if wallet is connected and on correct network
  if (web3.connected && web3.isCorrectNetwork && web3.procurementContract) {
    try {
      let receipt: { txHash: string; blockNumber: number; blockHash: string; onChainDisputeId?: string };

      switch (type) {
        case 'tender':
          if (data.action === 'publish') {
            receipt = await onChainPublishTender(web3.procurementContract, data);
          } else {
            receipt = await onChainTender(web3.procurementContract, data);
          }
          break;
        case 'bid':
        case 'bid_submission':
          receipt = await onChainBid(web3.procurementContract, data);
          break;
        case 'award':
          receipt = await onChainAward(web3.procurementContract, data);
          break;
        case 'payment':
          receipt = await onChainPayment(web3.procurementContract, data);
          break;
        case 'dispute':
          receipt = await onChainDispute(web3.procurementContract, data);
          break;
        case 'dao_resolution':
          receipt = await onChainVote(web3.procurementContract, data);
          break;
        case 'whistleblower_report':
          receipt = await onChainWhistleblower(web3.procurementContract, data);
          break;
        case 'objection':
          receipt = await onChainDispute(web3.procurementContract, data);
          break;
        case 'supplier_registration':
          receipt = await onChainRegister(web3.procurementContract, data);
          break;
        default:
          throw new Error(`Unknown type: ${type}`);
      }

      // Include on-chain dispute ID in the data if available
      const resultData = receipt.onChainDisputeId
        ? { ...data, onChainDisputeId: receipt.onChainDisputeId }
        : data;

      return {
        block: {
          index: receipt.blockNumber,
          timestamp: Date.now(),
          data: resultData,
          previousHash: '',
          hash: receipt.blockHash,
          nonce: 0,
        },
        contract: {
          id: receipt.txHash,
          type,
          status: 'executed',
          data: resultData,
          timestamp: Date.now(),
          transactionHash: receipt.txHash,
        },
        success: true,
        onChain: true,
      };
    } catch (err: any) {
      // Handle "Already registered" as a success — the supplier IS on-chain
      if (type === 'supplier_registration' && err?.reason === 'Already registered') {
        console.log('[Blockchain] Supplier already registered on-chain, treating as success');
        return {
          block: { index: 0, timestamp: Date.now(), data, previousHash: '', hash: keccak256(JSON.stringify(data)), nonce: 0 },
          contract: { id: `SC-${Date.now()}`, type, status: 'executed', data, timestamp: Date.now(), transactionHash: keccak256(JSON.stringify(data)) },
          success: true,
          onChain: true,
        };
      }
      console.error('On-chain transaction failed, falling back to simulation:', err);
      console.error('Details — connected:', web3.connected, 'isCorrectNetwork:', web3.isCorrectNetwork, 'contract:', !!web3.procurementContract, 'type:', type, 'data:', data);
      // Fall through to simulation
    }
  }

  // Fallback: use simulation
  return addProcurementRecord(type, data);
}

// ═══════════════════════════════════════════════════════════════════════
// ProcToken — balance & reward payment
// ═══════════════════════════════════════════════════════════════════════

export async function getTokenBalance(address: string): Promise<string> {
  const { tokenContract } = getWeb3State();
  if (!tokenContract) return '0';
  try {
    const raw = await tokenContract.balanceOf(address);
    return formatUnits(raw, 18);
  } catch {
    return '0';
  }
}

export async function payWhistleblowerReward(
  recipientAddress: string,
  amount: number,
  reportId: string
): Promise<{ txHash: string; success: boolean; onChain: boolean }> {
  const { tokenContract } = getWeb3State();
  if (!tokenContract) {
    return { txHash: '', success: false, onChain: false };
  }
  try {
    const amountWei = parseUnits(String(amount), 18);
    const tx = await tokenContract.payReward(recipientAddress, amountWei, `Whistleblower reward: ${reportId}`);
    const receipt = await tx.wait();
    console.log(`[ProcToken] Reward paid: ${amount} PROC to ${recipientAddress} for ${reportId}`);
    return { txHash: receipt.hash, success: true, onChain: true };
  } catch (err: any) {
    console.error('[ProcToken] payReward failed:', err?.reason || err?.message);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Simulation fallback — uses real SHA-256 cryptographic hashing
// ═══════════════════════════════════════════════════════════════════════

// Synchronous SHA-256 using Web Crypto API (returns hex string)
function sha256Sync(input: string): string {
  // Use a deterministic hash based on the input content.
  // Web Crypto's subtle.digest is async, so we use a synchronous
  // implementation of SHA-256 for the simulation blockchain.
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const k = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];

  // Pre-processing: convert string to bytes
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) { bytes.push(0xc0 | (code >> 6)); bytes.push(0x80 | (code & 0x3f)); }
    else { bytes.push(0xe0 | (code >> 12)); bytes.push(0x80 | ((code >> 6) & 0x3f)); bytes.push(0x80 | (code & 0x3f)); }
  }
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // Append 64-bit big-endian length
  for (let i = 56; i >= 0; i -= 8) bytes.push((bitLen >>> i) & 0xff);

  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  // Process each 512-bit block
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[offset + i * 4] << 24) | (bytes[offset + i * 4 + 1] << 16) | (bytes[offset + i * 4 + 2] << 8) | bytes[offset + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
}

class BlockchainService {
  private chain: Block[] = [];
  private difficulty = 2;

  constructor() {
    this.chain.push(this.createGenesisBlock());
  }

  private createGenesisBlock(): Block {
    const timestamp = Date.now();
    return {
      index: 0,
      timestamp,
      data: { type: 'genesis', message: 'Afghanistan Procurement Blockchain Initialized' },
      previousHash: '0'.repeat(64),
      hash: sha256Sync(JSON.stringify({ index: 0, timestamp, data: { type: 'genesis' }, previousHash: '0'.repeat(64), nonce: 0 })),
      nonce: 0,
    };
  }

  private calculateHash(index: number, timestamp: number, data: any, previousHash: string, nonce: number): string {
    return sha256Sync(JSON.stringify({ index, timestamp, data, previousHash, nonce }));
  }

  private mineBlock(index: number, timestamp: number, data: any, previousHash: string): Block {
    let nonce = 0;
    let hash = '';
    const target = '0'.repeat(this.difficulty);
    while (!hash.startsWith(target)) {
      nonce++;
      hash = this.calculateHash(index, timestamp, data, previousHash, nonce);
    }
    return { index, timestamp, data, previousHash, hash, nonce };
  }

  addBlock(data: any): Block {
    const previousBlock = this.chain[this.chain.length - 1];
    const newBlock = this.mineBlock(previousBlock.index + 1, Date.now(), data, previousBlock.hash);
    this.chain.push(newBlock);
    return newBlock;
  }

  getChain(): Block[] { return this.chain; }

  verifyChain(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const cur = this.chain[i];
      const prev = this.chain[i - 1];
      if (cur.hash !== this.calculateHash(cur.index, cur.timestamp, cur.data, cur.previousHash, cur.nonce)) return false;
      if (cur.previousHash !== prev.hash) return false;
    }
    return true;
  }

  getLatestBlock(): Block { return this.chain[this.chain.length - 1]; }
}

class SmartContractEngine {
  private contracts: SmartContract[] = [];

  executeContract(type: ContractType, data: any): SmartContract {
    const timestamp = Date.now();
    const txHash = `0x${sha256Sync(JSON.stringify({ type, data, timestamp }))}`;
    const contractId = `SC-${sha256Sync(String(timestamp) + type).substring(0, 16)}`;
    const contract: SmartContract = {
      id: contractId,
      type,
      status: 'executed',
      data,
      timestamp,
      transactionHash: txHash,
    };
    this.contracts.push(contract);
    return contract;
  }
}

export const blockchain = new BlockchainService();
export const smartContractEngine = new SmartContractEngine();

// Synchronous simulation fallback (used when wallet not connected)
export function addProcurementRecord(type: ContractType, data: Record<string, unknown>): ProcurementRecordResult {
  const contract = smartContractEngine.executeContract(type, data);
  const block = blockchain.addBlock({
    type,
    contractId: contract.id,
    transactionHash: contract.transactionHash,
    data,
    timestamp: Date.now(),
  });
  return { block, contract, success: contract.status === 'executed', onChain: false };
}
