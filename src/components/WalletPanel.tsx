import { useState } from 'react';
import { X, Send, PlusCircle, CreditCard, ArrowUpRight } from 'lucide-react';
import { blockchain } from '../utils/blockchain';

interface WalletPanelProps {
  balance: number;
  setBalance: (v: number) => void;
  transactions: any[];
  setTransactions: (txs: any[]) => void;
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
  onClose: () => void;
}

export function WalletPanel({
  balance,
  setBalance,
  transactions,
  setTransactions,
  setBlockchainRecords,
  blockchainRecords,
  onClose,
}: WalletPanelProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState<number | ''>('');

  const handleMint = () => {
    const minted = 1000;
    setBalance(balance + minted);
    const block = blockchain.addBlock({ type: 'token_mint', amount: minted, timestamp: Date.now() });
    const tx = { id: block.hash, type: 'mint', amount: minted, timestamp: Date.now() };
    setTransactions([tx, ...transactions]);
    setBlockchainRecords([
      ...blockchainRecords,
      { id: block.hash, type: 'token_mint', amount: minted, transactionHash: block.hash, timestamp: Date.now(), verified: true },
    ]);
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !amount || amount <= 0 || amount > balance) return;

    const newBalance = balance - Number(amount);
    setBalance(newBalance);

    const block = blockchain.addBlock({ type: 'token_transfer', to: recipient, amount: Number(amount), timestamp: Date.now() });
    const tx = { id: block.hash, type: 'transfer', to: recipient, amount: Number(amount), timestamp: Date.now() };
    setTransactions([tx, ...transactions]);
    setBlockchainRecords([
      ...blockchainRecords,
      { id: block.hash, type: 'token_transfer', to: recipient, amount: Number(amount), transactionHash: block.hash, timestamp: Date.now(), verified: true },
    ]);

    setRecipient('');
    setAmount('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose}></div>

      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full z-10 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-gray-700" />
            <div>
              <div className="text-gray-900 font-medium">Wallet</div>
              <div className="text-gray-600 text-sm">Balance: {balance} TOK</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleMint} className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded">
              <PlusCircle className="w-4 h-4" /> Mint
            </button>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <form onSubmit={handleTransfer} className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-gray-700 mb-1">Recipient Address</label>
              <input value={recipient} onChange={(e) => setRecipient(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="0xABC..." />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">Amount (TOK)</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} type="number" className="w-full px-3 py-2 border rounded" placeholder="100" />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded">
                <Send className="w-4 h-4" /> Transfer
              </button>
              <button type="button" onClick={() => { setRecipient(''); setAmount(''); }} className="px-4 py-2 border rounded">Reset</button>
            </div>
          </form>

          <div>
            <h4 className="text-gray-900 mb-2">Transactions</h4>
            {transactions.length === 0 ? (
              <div className="text-gray-600">No transactions yet</div>
            ) : (
              <div className="space-y-2">
                {transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <div className="text-gray-900">{t.type === 'mint' ? 'Mint' : 'Transfer to ' + t.to}</div>
                      <div className="text-gray-600 text-sm">{new Date(t.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="text-gray-900 flex items-center gap-2">
                      <div className="font-mono">{t.amount}</div>
                      <ArrowUpRight className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
