import { useState } from 'react';
import { X, Send, PlusCircle, CreditCard, ArrowUpRight } from 'lucide-react';
import { blockchain } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

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
  const [mintCount, setMintCount] = useState(0);
  const { t } = useTranslation();

  const MAX_MINT_BALANCE = 5000;
  const MAX_MINTS_PER_SESSION = 3;
  const canMint = balance < MAX_MINT_BALANCE && mintCount < MAX_MINTS_PER_SESSION;

  const handleMint = () => {
    if (!canMint) return;
    const minted = Math.min(1000, MAX_MINT_BALANCE - balance);
    setBalance(balance + minted);
    setMintCount(prev => prev + 1);
    const block = blockchain.addBlock({ type: 'token_mint', amount: minted, timestamp: Date.now() });
    const tx = { id: block.hash, type: 'mint', amount: minted, timestamp: Date.now() };
    setTransactions([tx, ...transactions]);
    setBlockchainRecords([
      ...blockchainRecords,
      { id: block.hash, type: 'token_mint', amount: minted, transactionHash: block.hash, timestamp: Date.now(), verified: false, simulated: true },
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
      { id: block.hash, type: 'token_transfer', to: recipient, amount: Number(amount), transactionHash: block.hash, timestamp: Date.now(), verified: false, simulated: true },
    ]);

    setRecipient('');
    setAmount('');
  };

  return (
    <div className="fixed z-50 flex items-center justify-center p-4" style={{ top: 110, left: 0, right: 0, bottom: 0 }}>
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} aria-hidden="true"></div>

      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full z-10 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-gray-700" />
            <div>
              <div className="text-gray-900 font-medium">{t('wallet.title')} <span style={{ fontSize: 11, fontWeight: 600, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', padding: '1px 8px', borderRadius: 999 }}>({t('wallet.simulated')})</span></div>
              <div className="text-gray-600 text-sm">{t('wallet.balance')} {balance} {t('wallet.tok')}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleMint} disabled={!canMint} className={`flex items-center gap-2 px-3 py-1 rounded focus:ring-2 focus:ring-green-400 focus:outline-none ${canMint ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
              <PlusCircle className="w-4 h-4" /> {t('wallet.mint')}
            </button>
            {mintCount > 0 && (
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                {MAX_MINTS_PER_SESSION - mintCount} {t('wallet.mintsRemaining')}
              </span>
            )}
            <button onClick={onClose} aria-label="Close" className="p-2 rounded hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Simulation Disclaimer */}
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
            padding: '10px 14px', fontSize: 12, color: '#92400e', lineHeight: 1.5,
          }}>
            {t('wallet.simulationDisclaimer')}
          </div>

          <form onSubmit={handleTransfer} className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-gray-700 mb-1">{t('wallet.recipientAddress')}</label>
              <input value={recipient} onChange={(e) => setRecipient(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder={t('wallet.recipientPlaceholder')} />
            </div>

            <div>
              <label className="block text-gray-700 mb-1">{t('wallet.amount')}</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} type="number" className="w-full px-3 py-2 border rounded" placeholder={t('wallet.amountPlaceholder')} />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded">
                <Send className="w-4 h-4" /> {t('wallet.transfer')}
              </button>
              <button type="button" onClick={() => { setRecipient(''); setAmount(''); }} className="px-4 py-2 border rounded">{t('wallet.reset')}</button>
            </div>
          </form>

          <div>
            <h4 className="text-gray-900 mb-2">{t('wallet.transactionsTitle')}</h4>
            {transactions.length === 0 ? (
              <div className="text-gray-600">{t('wallet.noTransactions')}</div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <div className="text-gray-900">{tx.type === 'mint' ? t('wallet.mintType') : tx.type === 'reward' ? (tx.label || t('wallet.rewardType')) : `${t('wallet.transferTo')} ${tx.to}`}</div>
                      <div className="text-gray-600 text-sm">{new Date(tx.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="text-gray-900 flex items-center gap-2">
                      <div className="font-mono">{tx.amount}</div>
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
