// Blockchain Service — Connects to real Ethereum testnet (Hardhat/Sepolia) via MetaMask,
// with in-memory simulation fallback when wallet is not connected.

import { getWeb3State } from './web3Provider';
import { id as keccak256 } from 'ethers';
import type { Contract } from 'ethers';

export interface Block {
  index: number;
  timestamp: number;
  data: any;
  previousHash: string;
  hash: string;
  nonce: number;
}

export type ContractType = 'tender' | 'bid' | 'award' | 'payment' | 'dispute' | 'dao_resolution' | 'whistleblower_report' | 'whistleblower_referral' | 'dispute_complaint' | 'evaluation_rereview' | 'objection' | 'supplier_registration' | 'bid_submission' | 'bid_reveal' | 'committee_propose' | 'committee_approve' | 'committee_vote';

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
): Promise<{ txHash: string; blockNumber: number; blockHash: string; onChainTenderId?: string }> {
  const title = String(data.title || '');
  const budget = BigInt(Number(String(data.budget).replace(/,/g, '')) || 0);
  const deadline = BigInt(Math.floor(new Date(String(data.deadline)).getTime() / 1000));
  const tx = await procContract.createTender(title, budget, deadline);
  const receipt = await tx.wait();

  // Extract on-chain tender ID from event and cache it
  const event = receipt.logs?.find((log: any) => {
    try { return procContract.interface.parseLog(log)?.name === 'TenderCreated'; } catch { return false; }
  });
  let onChainTenderId: string | undefined;
  if (event && data.localTenderId) {
    onChainTenderId = procContract.interface.parseLog(event)?.args?.[0];
    if (onChainTenderId) {
      onChainTenderIdCache[data.localTenderId as string] = onChainTenderId;
      console.log('[Blockchain] Cached on-chain tender ID for', data.localTenderId);
    }
  }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, onChainTenderId };
}

async function onChainPublishTender(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string; onChainTenderId?: string }> {
  const localId = data.tenderId as string;
  // Prefer whatever the caller already has persisted on the tender record
  // itself (survives reloads) before falling back to this session's own
  // cache, same pattern as every other on-chain call in this app.
  let onChainTenderId = (data.onChainTenderId as string) || onChainTenderIdCache[localId];

  if (!onChainTenderId) {
    // This tender was never actually created on-chain (most likely it was
    // created while no wallet was connected). Create it for real now,
    // using its actual title/budget/deadline — this is the Procuring
    // Entity's own Publish click paying for that one-time cost, instead of
    // leaving it to silently land on whichever bidder commits first (which
    // used to mean the first bid needed 3 separate MetaMask confirmations
    // — create, publish, commit — while every bid after it only needed 1).
    console.log('[Blockchain] Tender was never created on-chain — creating it now before publishing...');
    const title = String(data.title || '');
    const budget = BigInt(Number(String(data.budget).replace(/,/g, '')) || 0);
    const deadlineMs = new Date(String(data.deadline)).getTime();
    const deadline = BigInt(Number.isFinite(deadlineMs) && deadlineMs > 0 ? Math.floor(deadlineMs / 1000) : Math.floor(Date.now() / 1000) + 86400 * 30);
    const createTx = await procContract.createTender(title, budget, deadline);
    const createReceipt = await createTx.wait();
    const createdEvent = createReceipt.logs?.find((log: any) => {
      try { return procContract.interface.parseLog(log)?.name === 'TenderCreated'; } catch { return false; }
    });
    onChainTenderId = createdEvent ? procContract.interface.parseLog(createdEvent)?.args?.[0] : keccak256(localId);
    onChainTenderIdCache[localId] = onChainTenderId as string;
  }

  const tx = await procContract.publishTender(onChainTenderId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, onChainTenderId };
}

// Cache mapping: local bid ID (e.g. "BID-123") -> on-chain bytes32 bidId,
// captured from the BidCommitted/BidRevealed event at commit time. reveal/
// vote calls need this to address the exact on-chain bid record.
const onChainBidIdCache: Record<string, string> = {};

// Lets callers check whether a given local bid actually corresponds to
// what finalizeAward reports as the on-chain winner — the app's bid
// objects are identified by company name, not wallet address, so this
// cache (populated at commit/submitBidDirect time) is the only reliable
// bridge between the two identity systems for award reconciliation.
export function getOnChainBidId(localBidId: string): string | undefined {
  return onChainBidIdCache[localBidId];
}

// Repairs bids committed before onChainBidId persistence existed: every
// blockchainRecords entry already stores the original commit transaction's
// hash, so instead of treating "never captured it the first time" as
// unrecoverable, re-fetch that exact transaction's receipt from the chain
// and re-parse its BidCommitted event — the contract assigned the same
// bytes32 ID back then, it just never made it off this cache and onto the
// bid record. Read-only; needs no signature.
export async function recoverOnChainBidIdFromTx(
  txHash: string
): Promise<{ onChainTenderId?: string; onChainBidId?: string } | null> {
  const web3 = getWeb3State();
  if (!web3.provider || !web3.procurementContract) return null;
  const receipt = await web3.provider.getTransactionReceipt(txHash);
  if (!receipt) return null;
  const event = receipt.logs.find((log) => {
    try { return web3.procurementContract!.interface.parseLog(log)?.name === 'BidCommitted'; } catch { return false; }
  });
  if (!event) return null;
  const parsed = web3.procurementContract.interface.parseLog(event);
  const onChainTenderId = parsed?.args?.[0] as string | undefined;
  const onChainBidId = parsed?.args?.[1] as string | undefined;
  if (!onChainBidId) return null;
  return { onChainTenderId, onChainBidId };
}

// Resolves (and if necessary creates+publishes) the on-chain tender ID for
// a local tenderId — the same lazy-creation fallback the old onChainBid
// relied on, now shared by every bid-side call.
async function resolveOnChainTenderId(
  procContract: Contract,
  localTenderId: string,
  fallbackTitle: string,
  fallbackBudget: bigint
): Promise<string> {
  const cached = onChainTenderIdCache[localTenderId];
  if (cached) return cached;

  const hashedId = keccak256(localTenderId);
  const t = await procContract.tenders(hashedId);
  if (t.published) {
    onChainTenderIdCache[localTenderId] = hashedId;
    return hashedId;
  }

  console.log('[Blockchain] Tender not on-chain yet, creating & publishing first...');
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30);
  const createTx = await procContract.createTender(fallbackTitle, fallbackBudget, deadline);
  const createReceipt = await createTx.wait();
  const tenderCreatedEvent = createReceipt.logs?.find((log: any) => {
    try { return procContract.interface.parseLog(log)?.name === 'TenderCreated'; } catch { return false; }
  });
  const onChainTenderId = tenderCreatedEvent
    ? procContract.interface.parseLog(tenderCreatedEvent)?.args?.[0]
    : hashedId;
  onChainTenderIdCache[localTenderId] = onChainTenderId;

  const pubTx = await procContract.publishTender(onChainTenderId);
  await pubTx.wait();
  return onChainTenderId;
}

// Commit phase: only the commitment hash goes on-chain, never the amount.
async function onChainCommitBid(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string; onChainTenderId?: string; onChainBidId?: string }> {
  const localTenderId = data.tenderId as string;
  const commitment = data.commitment as string;
  // Prefer the tender's own persisted on-chain ID (set at publish time) —
  // a bid should never have to pay for creating/publishing its tender
  // itself. The lazy create-and-publish fallback below only fires for
  // older tenders published before this fix existed.
  const onChainTenderId = (data.onChainTenderId as string) || await resolveOnChainTenderId(procContract, localTenderId, String(data.vendor || localTenderId), 0n);

  const tx = await procContract.commitBid(onChainTenderId, commitment);
  const receipt = await tx.wait();

  const event = receipt.logs?.find((log: any) => {
    try { return procContract.interface.parseLog(log)?.name === 'BidCommitted'; } catch { return false; }
  });
  let onChainBidId: string | undefined;
  if (event && data.bidId) {
    onChainBidId = procContract.interface.parseLog(event)?.args?.[1];
    // Cache stays as a same-session fast path; the real durability comes
    // from the caller persisting onChainBidId/onChainTenderId onto the bid
    // record itself (see resultData merge below) — this cache alone used
    // to be the ONLY copy, which is why voting silently stopped working
    // for any bid after a page reload.
    if (onChainBidId) onChainBidIdCache[data.bidId as string] = onChainBidId;
  }
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, onChainTenderId, onChainBidId };
}

// Reveal phase: the chain itself recomputes keccak256(amount, salt) and
// reverts if it doesn't match the stored commitment — only ever called by
// the bidder after the deadline, same as the app-layer check.
async function onChainRevealBid(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string; onChainTenderId?: string; onChainBidId?: string }> {
  const localTenderId = data.tenderId as string;
  const localBidId = data.bidId as string;
  // Prefer whatever the caller already has persisted on the record itself
  // (survives reloads) before falling back to this session's own cache.
  const onChainTenderId = (data.onChainTenderId as string) || onChainTenderIdCache[localTenderId] || keccak256(localTenderId);
  const onChainBidId = (data.onChainBidId as string) || onChainBidIdCache[localBidId];
  if (!onChainBidId) {
    throw new Error(`No on-chain bid ID known for ${localBidId} — it was never committed on-chain, so it can't be revealed on-chain either.`);
  }
  const amount = BigInt(Number(String(data.amount).replace(/,/g, '')) || 0);
  const salt = data.salt as string;

  const tx = await procContract.revealBid(onChainTenderId, onChainBidId, amount, salt);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, onChainTenderId, onChainBidId };
}

// Single-Source only (Art. 3(10)) — nothing to seal against with one party.
async function onChainSubmitBidDirect(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string; onChainTenderId?: string; onChainBidId?: string }> {
  const localTenderId = data.tenderId as string;
  const amount = BigInt(Number(String(data.amount).replace(/,/g, '')) || 0);
  const onChainTenderId = (data.onChainTenderId as string) || await resolveOnChainTenderId(procContract, localTenderId, String(data.vendor || localTenderId), amount);

  const tx = await procContract.submitBidDirect(onChainTenderId, amount);
  const receipt = await tx.wait();

  const event = receipt.logs?.find((log: any) => {
    try { return procContract.interface.parseLog(log)?.name === 'BidRevealed'; } catch { return false; }
  });
  let onChainBidId: string | undefined;
  if (event && data.bidId) {
    onChainBidId = procContract.interface.parseLog(event)?.args?.[1];
    if (onChainBidId) onChainBidIdCache[data.bidId as string] = onChainBidId;
  }
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, onChainTenderId, onChainBidId };
}

async function onChainProposeCommittee(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string; onChainTenderId?: string }> {
  const onChainTenderId = (data.onChainTenderId as string) || onChainTenderIdCache[data.tenderId as string] || keccak256(data.tenderId as string);
  const members = data.members as [string, string, string];
  const tx = await procContract.proposeCommittee(onChainTenderId, members);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, onChainTenderId };
}

async function onChainApproveCommittee(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string; onChainTenderId?: string }> {
  const onChainTenderId = (data.onChainTenderId as string) || onChainTenderIdCache[data.tenderId as string] || keccak256(data.tenderId as string);
  const tx = await procContract.approveCommittee(onChainTenderId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, onChainTenderId };
}

async function onChainVoteOnBid(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string; onChainTenderId?: string; onChainBidId?: string }> {
  const onChainTenderId = (data.onChainTenderId as string) || onChainTenderIdCache[data.tenderId as string] || keccak256(data.tenderId as string);
  const onChainBidId = (data.onChainBidId as string) || onChainBidIdCache[data.bidId as string];
  if (!onChainBidId) {
    throw new Error(`No on-chain bid ID known for ${data.bidId} — it was never committed/revealed on-chain, so there is nothing on-chain to vote on.`);
  }
  const tx = await procContract.voteOnBid(onChainTenderId, onChainBidId, !!data.preliminaryPass, !!data.qualificationPass);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, onChainTenderId, onChainBidId };
}

// The contract computes the winner itself — lowest revealed amount among
// committee-qualified (2-of-3 majority) bids — from data already on-chain.
// No vendor/amount is accepted as input, so the caller can't assert an
// outcome; it can only read back what the chain actually decided from the
// ContractAwarded event.
async function onChainFinalizeAward(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string; onChainWinner?: string; onChainAmount?: string; onChainBidId?: string }> {
  const onChainTenderId = onChainTenderIdCache[data.tenderId as string] || keccak256(data.tenderId as string);
  const tx = await procContract.finalizeAward(onChainTenderId);
  const receipt = await tx.wait();

  const event = receipt.logs?.find((log: any) => {
    try { return procContract.interface.parseLog(log)?.name === 'ContractAwarded'; } catch { return false; }
  });
  let onChainWinner: string | undefined;
  let onChainAmount: string | undefined;
  let onChainBidId: string | undefined;
  if (event) {
    const parsed = procContract.interface.parseLog(event);
    onChainBidId = parsed?.args?.[1];
    onChainWinner = parsed?.args?.[2];
    onChainAmount = parsed?.args?.[3]?.toString();
  }
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash, onChainWinner, onChainAmount, onChainBidId };
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
      let receipt: { txHash: string; blockNumber: number; blockHash: string; onChainDisputeId?: string; onChainWinner?: string; onChainAmount?: string; onChainBidId?: string; onChainTenderId?: string };

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
          // Single-Source has nothing to seal against (Art. 3(10)) — goes
          // straight on-chain with a real amount. Every other method commits
          // only a hash; the real amount is posted in bid_reveal below.
          receipt = data.isSingleSource
            ? await onChainSubmitBidDirect(web3.procurementContract, data)
            : await onChainCommitBid(web3.procurementContract, data);
          break;
        case 'bid_reveal':
          receipt = await onChainRevealBid(web3.procurementContract, data);
          break;
        case 'committee_propose':
          receipt = await onChainProposeCommittee(web3.procurementContract, data);
          break;
        case 'committee_approve':
          receipt = await onChainApproveCommittee(web3.procurementContract, data);
          break;
        case 'committee_vote':
          receipt = await onChainVoteOnBid(web3.procurementContract, data);
          break;
        case 'award':
          receipt = await onChainFinalizeAward(web3.procurementContract, data);
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

      // Include on-chain dispute ID / finalizeAward's computed winner / the
      // real on-chain tender+bid IDs in the data if available, so the
      // caller can read back what the contract actually decided or
      // persist these IDs onto the record itself. Persisting them is what
      // makes voting/revealing survive a page reload — the in-memory
      // caches above are only a same-session fast path, never the only
      // copy.
      const resultData = (receipt.onChainDisputeId || receipt.onChainWinner || receipt.onChainBidId || receipt.onChainTenderId)
        ? { ...data, onChainDisputeId: receipt.onChainDisputeId, onChainWinner: receipt.onChainWinner, onChainAmount: receipt.onChainAmount, onChainBidId: receipt.onChainBidId, onChainTenderId: receipt.onChainTenderId }
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
