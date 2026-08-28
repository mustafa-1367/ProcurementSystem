import { useState, useEffect, useCallback } from 'react';
import { connectWallet, disconnectWallet, getWeb3State, onWeb3StateChange, switchToTargetNetwork, type Web3State } from './web3Provider';

export function useWeb3() {
  const [state, setState] = useState<Web3State>(getWeb3State());
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onWeb3StateChange(setState);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectWallet();
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectWallet();
    setError(null);
  }, []);

  const switchNetwork = useCallback(async () => {
    try {
      await switchToTargetNetwork();
    } catch (err: any) {
      setError(err.message || 'Failed to switch network');
    }
  }, []);

  return {
    ...state,
    connecting,
    error,
    connect,
    disconnect,
    switchNetwork,
  };
}
