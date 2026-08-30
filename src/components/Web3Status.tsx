import { useWeb3 } from '../utils/useWeb3';
import { getDeploymentInfo } from '../utils/web3Provider';
import { Wallet, Wifi, WifiOff, AlertTriangle, ExternalLink } from 'lucide-react';

export function Web3Status() {
  const { connected, account, chainId, networkName, isCorrectNetwork, connecting, error, connect, disconnect, switchNetwork } = useWeb3();
  const deployment = getDeploymentInfo();

  const shortAddress = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : '';

  if (!connected) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        <Wallet className="w-4 h-4" />
        {connecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          Wrong Network
        </div>
        <button
          onClick={switchNetwork}
          className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          Switch to {deployment.chainId === 31337 ? 'Hardhat' : 'Sepolia'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={disconnect}
      className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
      title={networkName}
    >
      <Wifi className="w-4 h-4" />
      {shortAddress}
    </button>
  );
}
