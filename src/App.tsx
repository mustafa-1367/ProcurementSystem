import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PreTenderPhase } from './components/PreTenderPhase';
import { TenderingPhase } from './components/TenderingPhase';
import { PostTenderingPhase } from './components/PostTenderingPhase';
import { BlockchainDashboard } from './components/BlockchainDashboard';
import { PublicAuditDashboard } from './components/PublicAuditDashboard';
import { DAOGovernance } from './components/DAOGovernance';
import { WhistleblowerPortal } from './components/WhistleblowerPortal';
import { ReputationSystem } from './components/ReputationSystem';
import { SupplierTracker } from './components/SupplierTracker';
import { HelpSupport } from './components/HelpSupport';
import { RegisterKYC } from './components/RegisterKYC';
import { SubmitBid } from './components/SubmitBid';
import { MyContracts } from './components/MyContracts';
import { DisputesAppeals } from './components/DisputesAppeals';
import { FeedbackWidget } from './components/FeedbackWidget';
import { FileText, Gavel, CheckCircle, Link as LinkIcon, Eye, Users, AlertTriangle, Award, CreditCard, Activity, Globe, Truck, HelpCircle, UserCheck, Send, Briefcase, Scale } from 'lucide-react';
import { WalletPanel } from './components/WalletPanel';
import { ProcurementDashboard } from './components/ProcurementDashboard';
import { LanguageProvider, useTranslation, Language } from './utils/i18n';

type UserRole = 'citizen' | 'supplier' | 'government' | 'auditor' | 'oversight';

const allTabs = [
  { id: 'dashboard',    icon: Activity },
  { id: 'pre',          icon: FileText },
  { id: 'tender',       icon: Gavel },
  { id: 'post',         icon: CheckCircle },
  { id: 'audit',        icon: Eye },
  { id: 'reputation',   icon: Award },
  { id: 'blockchain',   icon: LinkIcon },
  { id: 'dao',          icon: Users },
  { id: 'whistleblower',icon: AlertTriangle },
  { id: 'supplier',     icon: Truck },
  { id: 'register',     icon: UserCheck },
  { id: 'submitBid',    icon: Send },
  { id: 'myContracts',  icon: Briefcase },
  { id: 'disputes',     icon: Scale },
];

const roleTabs: Record<UserRole, string[]> = {
  government: ['dashboard', 'pre', 'tender', 'post', 'audit', 'reputation', 'blockchain', 'dao'],
  supplier:   ['dashboard', 'register', 'submitBid', 'myContracts', 'disputes', 'audit', 'reputation', 'whistleblower'],
  citizen:    ['dashboard', 'audit', 'reputation', 'blockchain', 'dao', 'whistleblower'],
  auditor:    ['dashboard', 'audit', 'blockchain', 'reputation'],
  oversight:  ['dashboard', 'dao', 'whistleblower', 'audit', 'reputation'],
};

const roleFirstTab: Record<UserRole, string> = {
  government: 'dashboard',
  supplier: 'dashboard',
  citizen: 'dashboard',
  auditor: 'dashboard',
  oversight: 'dashboard',
};

const roles: UserRole[] = ['citizen', 'supplier', 'government', 'auditor', 'oversight'];

function AppContent() {
  const [activePhase, setActivePhase] = useState<string>('dashboard');
  const [tenders, setTenders] = useState<any[]>([]);
  const [bids, setBids] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [blockchainRecords, setBlockchainRecords] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reputationScores, setReputationScores] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(5000);
  const [walletTxs, setWalletTxs] = useState<any[]>([]);
  const [showWallet, setShowWallet] = useState(false);
  const { t, language, setLanguage, dir } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('government');
  const tablistRef = useRef<HTMLDivElement>(null);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowLangMenu(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  useEffect(() => {
    if (!showLangMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        langBtnRef.current && !langBtnRef.current.contains(target) &&
        langMenuRef.current && !langMenuRef.current.contains(target)
      ) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLangMenu]);

  const switchRole = (role: UserRole) => {
    setUserRole(role);
    setActivePhase(roleFirstTab[role]);
  };

  const visibleTabIds = roleTabs[userRole];
  const visibleTabs = visibleTabIds.map((id) => allTabs.find((tab) => tab.id === id)!).filter(Boolean);

  // Arrow key navigation for tablist
  const handleTabKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const direction = e.key === 'ArrowRight' ? 1 : -1;
      nextIndex = (currentIndex + direction + visibleTabs.length) % visibleTabs.length;
    }
    if (nextIndex !== null) {
      const nextTab = visibleTabs[nextIndex];
      setActivePhase(nextTab.id);
      // Focus the button
      const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir={dir}>
      {/* Skip to main content — hidden off-screen, visible on focus */}
      <a
        href="#main-content"
        style={{ position: 'absolute', left: -9999, top: 0, background: '#c99a3c', color: '#0f2942', padding: '10px 16px', fontWeight: 700, zIndex: 100, borderRadius: '0 0 8px 0', textDecoration: 'none' }}
        onFocus={(e) => { e.currentTarget.style.left = '0'; }}
        onBlur={(e) => { e.currentTarget.style.left = '-9999px'; }}
      >
        {t('app.skipToContent')}
      </a>

      {/* ── Top Bar (Navy) ── */}
      <header className="sticky top-0 z-[60]" style={{ background: 'linear-gradient(180deg, #0f2942 0%, #173d61 100%)', boxShadow: '0 2px 10px rgba(0,0,0,.18)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between" style={{ padding: '10px 22px', height: 64 }}>
          {/* Left: Logo + Platform name */}
          <div className="flex items-center" style={{ gap: 11 }}>
            <div className="flex items-center justify-center shrink-0" style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #c99a3c, #e0b658)' }} aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Network mesh lines */}
                <g stroke="#0f2942" strokeWidth="1.5">
                  {/* Outer hexagon edges */}
                  <line x1="50" y1="5" x2="85" y2="20" /><line x1="85" y1="20" x2="95" y2="50" />
                  <line x1="95" y1="50" x2="85" y2="80" /><line x1="85" y1="80" x2="50" y2="95" />
                  <line x1="50" y1="95" x2="15" y2="80" /><line x1="15" y1="80" x2="5" y2="50" />
                  <line x1="5" y1="50" x2="15" y2="20" /><line x1="15" y1="20" x2="50" y2="5" />
                  {/* Inner ring connections */}
                  <line x1="50" y1="5" x2="35" y2="35" /><line x1="50" y1="5" x2="65" y2="35" />
                  <line x1="85" y1="20" x2="65" y2="35" /><line x1="95" y1="50" x2="70" y2="55" />
                  <line x1="85" y1="80" x2="65" y2="70" /><line x1="50" y1="95" x2="50" y2="70" />
                  <line x1="15" y1="80" x2="35" y2="70" /><line x1="5" y1="50" x2="30" y2="55" />
                  <line x1="15" y1="20" x2="35" y2="35" />
                  {/* Inner mesh */}
                  <line x1="35" y1="35" x2="65" y2="35" /><line x1="65" y1="35" x2="70" y2="55" />
                  <line x1="70" y1="55" x2="65" y2="70" /><line x1="65" y1="70" x2="50" y2="70" />
                  <line x1="50" y1="70" x2="35" y2="70" /><line x1="35" y1="70" x2="30" y2="55" />
                  <line x1="30" y1="55" x2="35" y2="35" />
                  {/* Cross connections */}
                  <line x1="35" y1="35" x2="50" y2="50" /><line x1="65" y1="35" x2="50" y2="50" />
                  <line x1="70" y1="55" x2="50" y2="50" /><line x1="65" y1="70" x2="50" y2="50" />
                  <line x1="35" y1="70" x2="50" y2="50" /><line x1="30" y1="55" x2="50" y2="50" />
                  <line x1="50" y1="70" x2="50" y2="50" />
                </g>
                {/* Nodes */}
                <g fill="#4db8a4">
                  <circle cx="50" cy="5" r="4" /><circle cx="85" cy="20" r="4" />
                  <circle cx="95" cy="50" r="4" /><circle cx="85" cy="80" r="4" />
                  <circle cx="50" cy="95" r="4" /><circle cx="15" cy="80" r="4" />
                  <circle cx="5" cy="50" r="4" /><circle cx="15" cy="20" r="4" />
                  <circle cx="35" cy="35" r="3.5" /><circle cx="65" cy="35" r="3.5" />
                  <circle cx="70" cy="55" r="3.5" /><circle cx="65" cy="70" r="3.5" />
                  <circle cx="50" cy="70" r="3.5" /><circle cx="35" cy="70" r="3.5" />
                  <circle cx="30" cy="55" r="3.5" /><circle cx="50" cy="50" r="4" />
                </g>
              </svg>
            </div>
            <div>
              <div className="text-white" style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.1 }}>{t('app.title')}</div>
              <div style={{ fontSize: 11, color: '#c7d3e0', letterSpacing: '0.03em' }}>{t('app.subtitle')}</div>
            </div>
          </div>

          {/* Right: Role switcher + utilities */}
          <div className="flex items-center" style={{ gap: 10 }}>
            <nav aria-label={t('role.switchRole')} className="flex" style={{ gap: 6, background: 'rgba(255,255,255,.08)', padding: 4, borderRadius: 999 }}>
              {roles.map((role) => (
                <button
                  key={role}
                  onClick={() => switchRole(role)}
                  style={{
                    border: 'none',
                    background: userRole === role ? '#c99a3c' : 'transparent',
                    color: userRole === role ? '#0f2942' : '#dbe4ee',
                    padding: '8px 14px',
                    borderRadius: 999,
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap' as const,
                    transition: '.15s',
                  }}
                  className="focus:outline-none focus:ring-2 focus:ring-white focus:ring-inset"
                  onMouseEnter={(e) => { if (userRole !== role) (e.target as HTMLElement).style.background = 'rgba(255,255,255,.10)'; }}
                  onMouseLeave={(e) => { if (userRole !== role) (e.target as HTMLElement).style.background = 'transparent'; }}
                >
                  {t(`role.${role}`)}
                </button>
              ))}
            </nav>

            {/* Language Switcher */}
            <div>
              <button
                ref={langBtnRef}
                onClick={() => setShowLangMenu(!showLangMenu)}
                aria-expanded={showLangMenu}
                aria-haspopup="true"
                className="flex items-center gap-1.5 hover:text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                style={{ color: '#c7d3e0', padding: '6px 8px', fontSize: '12.5px' }}
              >
                <Globe className="w-4 h-4" />
                <span>{t(`lang.${language}`)}</span>
              </button>
              {showLangMenu && langBtnRef.current && createPortal(
                <div ref={langMenuRef} role="menu" style={{
                  position: 'fixed',
                  top: langBtnRef.current.getBoundingClientRect().bottom + 4,
                  left: langBtnRef.current.getBoundingClientRect().left,
                  zIndex: 9999,
                  minWidth: 110,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,.15)',
                }}>
                  {([['en', 'English'], ['fa', 'فارسی'], ['ps', 'پشتو']] as const).map(([code, label], i, arr) => (
                    <button
                      key={code}
                      role="menuitem"
                      onClick={() => { setLanguage(code as Language); setShowLangMenu(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'start',
                        padding: '8px 16px', fontSize: '13px', border: 'none',
                        background: language === code ? '#eff6ff' : '#fff',
                        color: language === code ? '#1d4ed8' : '#374151',
                        cursor: 'pointer',
                        borderRadius: i === 0 ? '8px 8px 0 0' : i === arr.length - 1 ? '0 0 8px 8px' : '0',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>

            {/* Help */}
            <button
              onClick={() => { setActivePhase('help'); setShowWallet(false); setShowLangMenu(false); }}
              className="flex items-center gap-1.5 hover:text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-white"
              style={{ color: activePhase === 'help' ? '#ffffff' : '#c7d3e0', padding: '6px 8px', fontSize: '12.5px' }}
            >
              <HelpCircle className="w-4 h-4" />
              <span>{t('nav.help')}</span>
            </button>

            {/* Wallet */}
            <button
              onClick={() => { setShowWallet(true); setShowLangMenu(false); }}
              className="flex items-center gap-1.5 hover:text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-white"
              style={{ color: '#c7d3e0', padding: '6px 8px', fontSize: '12.5px' }}
            >
              <CreditCard className="w-4 h-4" />
              <span>{walletBalance} {t('app.tok')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Tab Strip (Light, sticky below navy bar) ── */}
      <div className="sticky z-[60]" style={{ top: 64, background: '#fcfcfb', borderBottom: '1px solid rgba(11,11,11,0.10)' }}>
        <div className="max-w-7xl mx-auto" style={{ padding: '0 22px' }}>
          <div
            ref={tablistRef}
            role="tablist"
            aria-label={t('nav.tablistLabel')}
            className="flex overflow-x-auto" style={{ gap: 2 }}
          >
            {visibleTabs.map((tab, index) => {
              const isActive = activePhase === tab.id;
              const navKey = tab.id === 'dashboard' ? (userRole === 'supplier' ? 'myDashboard' : userRole === 'government' ? 'tenderManagement' : userRole === 'citizen' ? 'home' : userRole === 'auditor' ? 'auditOverview' : userRole === 'oversight' ? 'oversightOverview' : 'procurement') : tab.id === 'pre' ? 'preTender' : tab.id === 'tender' ? 'tendering' : tab.id === 'post' ? 'postTender' : tab.id === 'audit' ? 'publicAudit' : tab.id === 'dao' ? 'daoGovernance' : tab.id === 'supplier' ? 'supplierTracker' : tab.id === 'submitBid' ? 'submitBid' : tab.id === 'myContracts' ? 'myContracts' : tab.id === 'disputes' ? 'disputes' : tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => { setActivePhase(tab.id); setShowWallet(false); }}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  className="focus:outline-none"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '13px 14px',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: isActive ? '#0f2942' : '#52514e',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap' as const,
                    borderBottom: `3px solid ${isActive ? '#c99a3c' : 'transparent'}`,
                    transition: '.15s',
                  }}
                  onMouseEnter={(e) => { if (!isActive) { (e.target as HTMLElement).style.color = '#0b0b0b'; (e.target as HTMLElement).style.background = '#f6f5f2'; } }}
                  onMouseLeave={(e) => { if (!isActive) { (e.target as HTMLElement).style.color = '#52514e'; (e.target as HTMLElement).style.background = 'transparent'; } }}
                >
                  {t(`nav.${navKey}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
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
            userRole={userRole}
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
            userRole={userRole}
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
            userRole={userRole}
            walletBalance={walletBalance}
            setWalletBalance={setWalletBalance}
            walletTxs={walletTxs}
            setWalletTxs={setWalletTxs}
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
            walletBalance={walletBalance}
            setWalletBalance={setWalletBalance}
            walletTxs={walletTxs}
            setWalletTxs={setWalletTxs}
          />
        )}
        {activePhase === 'reputation' && (
          <ReputationSystem
            reputationScores={reputationScores}
            bids={bids}
            contracts={contracts}
          />
        )}
        {activePhase === 'supplier' && (
          <SupplierTracker
            bids={bids}
            contracts={contracts}
            disputes={disputes}
            reports={reports}
            tenders={tenders}
            blockchainRecords={blockchainRecords}
          />
        )}
        {activePhase === 'blockchain' && (
          <BlockchainDashboard
            blockchainRecords={blockchainRecords}
            userRole={userRole}
            walletBalance={walletBalance}
            setWalletBalance={setWalletBalance}
            walletTxs={walletTxs}
            setWalletTxs={setWalletTxs}
          />
        )}
        {activePhase === 'register' && (
          <RegisterKYC
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
            userRole={userRole}
            walletBalance={walletBalance}
            setWalletBalance={setWalletBalance}
            walletTxs={walletTxs}
            setWalletTxs={setWalletTxs}
          />
        )}
        {activePhase === 'submitBid' && (
          <SubmitBid
            tenders={tenders}
            bids={bids}
            setBids={setBids}
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
          />
        )}
        {activePhase === 'myContracts' && (
          <MyContracts
            contracts={contracts}
            bids={bids}
            tenders={tenders}
          />
        )}
        {activePhase === 'disputes' && (
          <DisputesAppeals
            disputes={disputes}
            setDisputes={setDisputes}
            contracts={contracts}
            tenders={tenders}
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
          />
        )}
        {activePhase === 'help' && (
          <HelpSupport />
        )}
      </main>

      <FeedbackWidget />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
