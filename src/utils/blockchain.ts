// Simulated Blockchain Service for Procurement Management

export interface Block {
  index: number;
  timestamp: number;
  data: any;
  previousHash: string;
  hash: string;
  nonce: number;
}

export interface SmartContract {
  id: string;
  type: 'tender' | 'bid' | 'award' | 'payment';
  status: 'pending' | 'executed' | 'failed';
  data: any;
  timestamp: number;
  transactionHash: string;
}

class BlockchainService {
  private chain: Block[] = [];
  private difficulty = 2;

  constructor() {
    // Create genesis block
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

  private calculateHash(
    index: number,
    timestamp: number,
    data: any,
    previousHash: string,
    nonce: number
  ): string {
    const dataString = JSON.stringify({ index, timestamp, data, previousHash, nonce });
    // Simple hash simulation (in production, use SHA-256 or similar)
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  private mineBlock(
    index: number,
    timestamp: number,
    data: any,
    previousHash: string
  ): Block {
    let nonce = 0;
    let hash = '';
    const target = '0'.repeat(this.difficulty);

    while (!hash.startsWith(target)) {
      nonce++;
      hash = this.calculateHash(index, timestamp, data, previousHash, nonce);
    }

    return {
      index,
      timestamp,
      data,
      previousHash,
      hash,
      nonce,
    };
  }

  addBlock(data: any): Block {
    const previousBlock = this.chain[this.chain.length - 1];
    const newBlock = this.mineBlock(
      previousBlock.index + 1,
      Date.now(),
      data,
      previousBlock.hash
    );
    this.chain.push(newBlock);
    return newBlock;
  }

  getChain(): Block[] {
    return this.chain;
  }

  verifyChain(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Verify hash
      const recalculatedHash = this.calculateHash(
        currentBlock.index,
        currentBlock.timestamp,
        currentBlock.data,
        currentBlock.previousHash,
        currentBlock.nonce
      );

      if (currentBlock.hash !== recalculatedHash) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }

  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }
}

// Smart Contract Execution Engine
class SmartContractEngine {
  private contracts: SmartContract[] = [];

  executeContract(type: string, data: any): SmartContract {
    const contract: SmartContract = {
      id: this.generateContractId(),
      type: type as any,
      status: 'pending',
      data,
      timestamp: Date.now(),
      transactionHash: '',
    };

    // Simulate contract execution logic
    try {
      switch (type) {
        case 'tender':
          this.executeTenderContract(contract);
          break;
        case 'bid':
          this.executeBidContract(contract);
          break;
        case 'award':
          this.executeAwardContract(contract);
          break;
        case 'payment':
          this.executePaymentContract(contract);
          break;
        default:
          throw new Error('Unknown contract type');
      }
      contract.status = 'executed';
    } catch (error) {
      contract.status = 'failed';
    }

    this.contracts.push(contract);
    return contract;
  }

  private executeTenderContract(contract: SmartContract): void {
    // Validate tender data
    const { title, budget, deadline } = contract.data;
    if (!title || !budget || !deadline) {
      throw new Error('Invalid tender data');
    }
    contract.transactionHash = this.generateTransactionHash();
  }

  private executeBidContract(contract: SmartContract): void {
    // Validate bid data
    const { tenderId, amount, vendor } = contract.data;
    if (!tenderId || !amount || !vendor) {
      throw new Error('Invalid bid data');
    }
    contract.transactionHash = this.generateTransactionHash();
  }

  private executeAwardContract(contract: SmartContract): void {
    // Validate award data
    const { tenderId, bidderId, amount } = contract.data;
    if (!tenderId || !bidderId || !amount) {
      throw new Error('Invalid award data');
    }
    contract.transactionHash = this.generateTransactionHash();
  }

  private executePaymentContract(contract: SmartContract): void {
    // Validate payment data
    const { contractId, amount, milestone } = contract.data;
    if (!contractId || !amount || !milestone) {
      throw new Error('Invalid payment data');
    }
    contract.transactionHash = this.generateTransactionHash();
  }

  private generateContractId(): string {
    return `SC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTransactionHash(): string {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  getContracts(): SmartContract[] {
    return this.contracts;
  }
}

// Export singleton instances
export const blockchain = new BlockchainService();
export const smartContractEngine = new SmartContractEngine();

// Helper function to add procurement record to blockchain
export function addProcurementRecord(type: string, data: any) {
  // Execute smart contract first
  const contract = smartContractEngine.executeContract(type, data);
  
  // Add to blockchain
  const block = blockchain.addBlock({
    type,
    contractId: contract.id,
    transactionHash: contract.transactionHash,
    data,
    timestamp: Date.now(),
  });

  return { block, contract };
}
