import { BrowserProvider, JsonRpcProvider, Contract, type Signer, type Provider } from 'ethers';
import deployments from './deployments.json';
import ProcurementSystemABI from './abis/ProcurementSystem.json';
import ProcTokenABI from './abis/ProcToken.json';
import WhistleblowerVerifierABI from './abis/WhistleblowerVerifier.json';

// Network configurations
const NETWORKS: Record<number, { name: string; rpcUrl: string }> = {
  31337: { name: 'Hardhat Local', rpcUrl: 'http://127.0.0.1:8545' },
  11155111: { name: 'Sepolia Testnet', rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com' },
};

export interface Web3State {
  connected: boolean;
  account: string | null;
  chainId: number | null;
  networkName: string | null;
  provider: Provider | null;
  signer: Signer | null;
  procurementContract: Contract | null;
  tokenContract: Contract | null;
  whistleblowerVerifierContract: Contract | null;
  isCorrectNetwork: boolean;
}

const initialState: Web3State = {
  connected: false,
  account: null,
  chainId: null,
  networkName: null,
  provider: null,
  signer: null,
  procurementContract: null,
  tokenContract: null,
  whistleblowerVerifierContract: null,
  isCorrectNetwork: false,
};

let currentState: Web3State = { ...initialState };
let listeners: ((state: Web3State) => void)[] = [];

function notifyListeners() {
  listeners.forEach((fn) => fn(currentState));
}

export function onWeb3StateChange(fn: (state: Web3State) => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getWeb3State(): Web3State {
  return currentState;
}

function getMetaMaskProvider(): any {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return (window as any).ethereum;
  }
  return null;
}

export async function connectWallet(): Promise<Web3State> {
  const ethereum = getMetaMaskProvider();
  if (!ethereum) {
    throw new Error('MetaMask not found. Please install MetaMask browser extension.');
  }

  // Request account access
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  const targetChainId = deployments.chainId;
  const isCorrectNetwork = chainId === targetChainId;

  let procurementContract: Contract | null = null;
  let tokenContract: Contract | null = null;
  let whistleblowerVerifierContract: Contract | null = null;

  if (isCorrectNetwork) {
    procurementContract = new Contract(
      deployments.contracts.ProcurementSystem,
      ProcurementSystemABI,
      signer
    );
    tokenContract = new Contract(
      deployments.contracts.ProcToken,
      ProcTokenABI,
      signer
    );
    if ((deployments.contracts as any).WhistleblowerVerifier) {
      whistleblowerVerifierContract = new Contract(
        (deployments.contracts as any).WhistleblowerVerifier,
        WhistleblowerVerifierABI,
        signer
      );
    }
  }

  currentState = {
    connected: true,
    account: accounts[0],
    chainId,
    networkName: NETWORKS[chainId]?.name || `Chain ${chainId}`,
    provider,
    signer,
    procurementContract,
    tokenContract,
    whistleblowerVerifierContract,
    isCorrectNetwork,
  };

  // Listen for account/chain changes
  ethereum.on('accountsChanged', handleAccountsChanged);
  ethereum.on('chainChanged', () => window.location.reload());

  notifyListeners();
  return currentState;
}

async function handleAccountsChanged(accounts: string[]) {
  if (accounts.length === 0) {
    disconnectWallet();
  } else {
    currentState = { ...currentState, account: accounts[0] };
    // Reconnect contracts with new signer
    if (currentState.connected) {
      await connectWallet();
    }
  }
}

export function disconnectWallet() {
  const ethereum = getMetaMaskProvider();
  if (ethereum) {
    ethereum.removeListener('accountsChanged', handleAccountsChanged);
  }
  currentState = { ...initialState };
  notifyListeners();
}

export async function switchToTargetNetwork(): Promise<void> {
  const ethereum = getMetaMaskProvider();
  if (!ethereum) return;

  const targetChainId = deployments.chainId;

  if (targetChainId === 31337) {
    // Add Hardhat localhost network
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7A69' }], // 31337 in hex
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x7A69',
            chainName: 'Hardhat Local',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['http://127.0.0.1:8545'],
          }],
        });
      }
    }
  } else if (targetChainId === 11155111) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xAA36A7' }], // 11155111 in hex
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xAA36A7',
            chainName: 'Sepolia Testnet',
            nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://rpc.sepolia.org'],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          }],
        });
      }
    }
  }
}

// Read-only provider (for when wallet is not connected)
export function getReadOnlyProvider(): JsonRpcProvider {
  const network = NETWORKS[deployments.chainId];
  return new JsonRpcProvider(network?.rpcUrl || 'http://127.0.0.1:8545');
}

export function getDeploymentInfo() {
  return deployments;
}
