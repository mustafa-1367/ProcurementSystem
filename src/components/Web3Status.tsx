import { useState, useEffect } from 'react';
import { useWeb3 } from '../utils/useWeb3';
import { getDeploymentInfo } from '../utils/web3Provider';
import { getTokenBalance } from '../utils/blockchain';
import { Wallet, Wifi, WifiOff, AlertTriangle, ExternalLink, Coins } from 'lucide-react';

export function Web3Status() {
  const { connected, account, chainId, networkName, isCorrectNetwork, connecting, error, connect, disconnect, switchNetwork, tokenContract } = useWeb3();
  const deployment = getDeploymentInfo();
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !isCorrectNetwork || !account || !tokenContract) {
      setBalance(null);
      return;
    }
    const fetchBalance = () => {
      getTokenBalance(account).then((b) => {
        const whole = Math.floor(Number(b));
        setBalance(whole.toLocaleString());
      });
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [connected, isCorrectNetwork, account, tokenContract]);

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
      {balance !== null && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold"
          style={{ background: 'rgba(201,154,60,.15)', color: '#c99a3c', border: '1px solid rgba(201,154,60,.3)' }}
          title="PROC Token Balance"
        >
          <Coins className="w-3.5 h-3.5" />
          {balance} PROC
        </div>
      )}
      <button
        onClick={disconnect}
        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
        title={networkName}
      >
        <Wifi className="w-4 h-4" />
        {shortAddress}
      </button>
    </div>
  );
}
