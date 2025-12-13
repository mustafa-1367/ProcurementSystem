import { useState } from 'react';
import { PreTenderPhase } from './components/PreTenderPhase';
import { TenderingPhase } from './components/TenderingPhase';
import { PostTenderingPhase } from './components/PostTenderingPhase';
import { BlockchainDashboard } from './components/BlockchainDashboard';
import { PublicAuditDashboard } from './components/PublicAuditDashboard';
import { DAOGovernance } from './components/DAOGovernance';
import { WhistleblowerPortal } from './components/WhistleblowerPortal';
import { ReputationSystem } from './components/ReputationSystem';
import { FileText, Gavel, CheckCircle, Link as LinkIcon, Eye, Users, AlertTriangle, Award, CreditCard, Activity } from 'lucide-react';
import { WalletPanel } from './components/WalletPanel';
import { ProcurementDashboard } from './components/ProcurementDashboard';

export default function App() {
  const [activePhase, setActivePhase] = useState<'pre' | 'tender' | 'post' | 'blockchain' | 'audit' | 'dao' | 'whistleblower' | 'reputation'>('pre');
  const [tenders, setTenders] = useState<any[]>([]);
  const [bids, setBids] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [blockchainRecords, setBlockchainRecords] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reputationScores, setReputationScores] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(5000); // mock token balance
  const [walletTxs, setWalletTxs] = useState<any[]>([]);
  const [showWallet, setShowWallet] = useState(false);

  const phases = [
    { id: 'dashboard', name: 'Procurement', icon: Activity },
    { id: 'pre', name: 'Pre-Tender', icon: FileText },
    { id: 'tender', name: 'Tendering', icon: Gavel },
    { id: 'post', name: 'Post-Tender', icon: CheckCircle },
    { id: 'audit', name: 'Public Audit', icon: Eye },
    { id: 'dao', name: 'DAO Governance', icon: Users },
    { id: 'whistleblower', name: 'Whistleblower', icon: AlertTriangle },
    { id: 'reputation', name: 'Reputation', icon: Award },
    { id: 'blockchain', name: 'Blockchain', icon: LinkIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-gray-900">Afghanistan Blockchain Public Procurement Platform</h1>
              <p className="text-gray-600 mt-1">Trustworthy • Transparent • Accountable • Secure</p>
            </div>
            <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-700">Blockchain Active</span>
            </div>
            <button
              onClick={() => setShowWallet(true)}
              className="ml-4 flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 hover:shadow-sm"
            >
              <CreditCard className="w-4 h-4 text-gray-700" />
              <span className="text-gray-700">{walletBalance} TOK</span>
            </button>
          </div>
        </div>
      </header>

      {/* Phase Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto">
            {phases.map((phase) => {
              const Icon = phase.icon;
              return (
                <button
                  key={phase.id}
                  onClick={() => setActivePhase(phase.id as any)}
                  className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${
                    activePhase === phase.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{phase.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {activePhase === 'dashboard' && (
          <ProcurementDashboard
            setActivePhase={setActivePhase}
            setShowWallet={setShowWallet}
            tenders={tenders}
            bids={bids}
            contracts={contracts}
            reports={reports}
            blockchainRecords={blockchainRecords}
            setTenders={setTenders}
            setBids={setBids}
            setContracts={setContracts}
            setReports={setReports}
            setBlockchainRecords={setBlockchainRecords}
          />
        )}
        {showWallet && (
          <WalletPanel
            balance={walletBalance}
            setBalance={setWalletBalance}
            transactions={walletTxs}
            setTransactions={setWalletTxs}
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
            onClose={() => setShowWallet(false)}
          />
        )}
        {activePhase === 'pre' && (
          <PreTenderPhase
            tenders={tenders}
            setTenders={setTenders}
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
          />
        )}
        {activePhase === 'tender' && (
          <TenderingPhase
            tenders={tenders}
            bids={bids}
            setBids={setBids}
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
            reputationScores={reputationScores}
          />
        )}
        {activePhase === 'post' && (
          <PostTenderingPhase
            tenders={tenders}
            bids={bids}
            contracts={contracts}
            setContracts={setContracts}
            setTenders={setTenders}
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
            setReputationScores={setReputationScores}
            reputationScores={reputationScores}
          />
        )}
        {activePhase === 'audit' && (
          <PublicAuditDashboard
            tenders={tenders}
            bids={bids}
            contracts={contracts}
            blockchainRecords={blockchainRecords}
          />
        )}
        {activePhase === 'dao' && (
          <DAOGovernance
            disputes={disputes}
            setDisputes={setDisputes}
            tenders={tenders}
            contracts={contracts}
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
          />
        )}
        {activePhase === 'whistleblower' && (
          <WhistleblowerPortal
            reports={reports}
            setReports={setReports}
            tenders={tenders}
            contracts={contracts}
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
          />
        )}
        {activePhase === 'reputation' && (
          <ReputationSystem
            reputationScores={reputationScores}
            bids={bids}
            contracts={contracts}
          />
        )}
        {activePhase === 'blockchain' && (
          <BlockchainDashboard blockchainRecords={blockchainRecords} />
        )}
      </main>
    </div>
  );
}