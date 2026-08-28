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
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-800 border border-green-200 rounded-lg text-sm">
        <Wifi className="w-3.5 h-3.5" />
        <span className="font-medium">{networkName}</span>
        <span className="text-green-600 font-mono text-xs">{shortAddress}</span>
      </div>
      <button
        onClick={disconnect}
        className="p-1.5 text-gray-500 hover:text-red-600 rounded transition-colors"
        title="Disconnect wallet"
      >
        <WifiOff className="w-4 h-4" />
      </button>
      {error && (
        <span className="text-red-600 text-xs">{error}</span>
      )}
    </div>
  );
}
