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

async function onChainTender(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const title = String(data.title || '');
  const budget = BigInt(Number(String(data.budget).replace(/,/g, '')) || 0);
  const deadline = BigInt(Math.floor(new Date(String(data.deadline)).getTime() / 1000));
  const tx = await procContract.createTender(title, budget, deadline);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}

async function onChainPublishTender(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const tenderId = keccak256(data.tenderId as string);
  const tx = await procContract.publishTender(tenderId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}

async function onChainBid(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const amount = BigInt(Number(String(data.amount).replace(/,/g, '')) || 0);

  // Try to submit the bid directly first
  const tenderId = keccak256(data.tenderId as string);
  try {
    const tx = await procContract.submitBid(tenderId, amount);
    const receipt = await tx.wait();
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
  } catch (bidErr: any) {
    // If tender doesn't exist or isn't published on-chain, create & publish it first
    if (bidErr?.reason === 'Tender not published' || bidErr?.reason === 'Tender does not exist') {
      console.log('[Blockchain] Tender not on-chain yet, creating & publishing first...');
      const title = String(data.vendor || data.tenderId || '');
      const budget = BigInt(Number(String(data.amount).replace(/,/g, '')) || 0);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30); // 30 days from now

      // Create tender on-chain — returns the on-chain tenderId
      const createTx = await procContract.createTender(title, budget, deadline);
      const createReceipt = await createTx.wait();

      // Get the tenderId from the event log
      const tenderCreatedEvent = createReceipt.logs?.find((log: any) => {
        try { return procContract.interface.parseLog(log)?.name === 'TenderCreated'; } catch { return false; }
      });
      const onChainTenderId = tenderCreatedEvent
        ? procContract.interface.parseLog(tenderCreatedEvent)?.args?.[0]
        : tenderId;

      // Publish the tender
      const pubTx = await procContract.publishTender(onChainTenderId);
      await pubTx.wait();

      // Now submit the bid with the on-chain tenderId
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

async function onChainDispute(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const title = String(data.title || 'Dispute');
  const tx = await procContract.createDispute(title);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}

async function onChainVote(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const disputeId = keccak256(data.disputeId as string);
  const approve = Boolean(data.approve);
  const tx = await procContract.castVote(disputeId, approve);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, blockHash: receipt.blockHash };
}

async function onChainWhistleblower(
  procContract: Contract,
  data: Record<string, unknown>
): Promise<{ txHash: string; blockNumber: number; blockHash: string }> {
  const zkProofHash = data.zkProof as string || '0x' + '0'.repeat(64);
  const category = String(data.category || '');
  const severity = String(data.severity || '');
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
      let receipt: { txHash: string; blockNumber: number; blockHash: string };

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

      return {
        block: {
          index: receipt.blockNumber,
          timestamp: Date.now(),
          data,
          previousHash: '',
          hash: receipt.blockHash,
          nonce: 0,
        },
        contract: {
          id: receipt.txHash,
          type,
          status: 'executed',
          data,
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
// Simulation fallback (original in-memory blockchain)
// ═══════════════════════════════════════════════════════════════════════

class BlockchainService {
  private chain: Block[] = [];
  private difficulty = 2;

  constructor() {
    this.chain.push(this.createGenesisBlock());
  }

  private createGenesisBlock(): Block {
    return {
      index: 0,
      timestamp: Date.now(),
      data: { type: 'genesis', message: 'Afghanistan Procurement Blockchain Initialized' },
      previousHash: '0',
      hash: this.calculateHash(0, Date.now(), { type: 'genesis' }, '0', 0),
      nonce: 0,
    };
  }

  private calculateHash(index: number, timestamp: number, data: any, previousHash: string, nonce: number): string {
    const dataString = JSON.stringify({ index, timestamp, data, previousHash, nonce });
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
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
    const contract: SmartContract = {
      id: `SC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: 'pending',
      data,
      timestamp: Date.now(),
      transactionHash: '',
    };
    try {
      contract.transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;
      contract.status = 'executed';
    } catch {
      contract.status = 'failed';
    }
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
