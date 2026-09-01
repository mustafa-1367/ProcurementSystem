import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PreTenderPhase } from './components/PreTenderPhase';
import { TenderingPhase } from './components/TenderingPhase';
import { PostTenderingPhase } from './components/PostTenderingPhase';
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
import { FileText, Gavel, CheckCircle, Eye, Users, AlertTriangle, Award, Activity, Globe, Truck, HelpCircle, UserCheck, Send, Briefcase, Scale, Minus, Plus, Type, Search, X, ArrowRight, Lock, Database } from 'lucide-react';
import { generateDemoData } from './data/demoData';
import { Web3Status } from './components/Web3Status';
import { ProcurementDashboard } from './components/ProcurementDashboard';
import { LanguageProvider, useTranslation, Language } from './utils/i18n';
import { loadSharedState, saveSharedState } from './utils/sharedStorage';
import { useWeb3 } from './utils/useWeb3';


type UserRole = 'citizen' | 'supplier' | 'government' | 'auditor' | 'oversight';

const ROLE_MAP: Record<number, UserRole> = {
  1: 'citizen',
  2: 'supplier',
  3: 'government',
  4: 'auditor',
  5: 'oversight',
};

const ALL_ROLES: UserRole[] = ['citizen', 'supplier', 'government', 'auditor', 'oversight'];



const allTabs = [
  { id: 'dashboard',    icon: Activity },
  { id: 'pre',          icon: FileText },
  { id: 'tender',       icon: Gavel },
  { id: 'post',         icon: CheckCircle },
  { id: 'audit',        icon: Eye },
  { id: 'reputation',   icon: Award },
  { id: 'dao',          icon: Users },
  { id: 'whistleblower',icon: AlertTriangle },
  { id: 'supplier',     icon: Truck },
  { id: 'register',     icon: UserCheck },
  { id: 'submitBid',    icon: Send },
  { id: 'myContracts',  icon: Briefcase },
  { id: 'disputes',     icon: Scale },
];

const roleTabs: Record<UserRole, string[]> = {
  government: ['dashboard', 'pre', 'tender', 'post', 'audit', 'reputation'],
  supplier:   ['dashboard', 'register', 'submitBid', 'myContracts', 'disputes', 'reputation', 'whistleblower'],
  citizen:    ['dashboard', 'audit', 'whistleblower', 'reputation'],
  auditor:    ['dashboard', 'supplier', 'reputation', 'whistleblower', 'dao'],
  oversight:  ['dashboard', 'audit', 'supplier', 'whistleblower', 'dao', 'reputation'],
};

const roleFirstTab: Record<UserRole, string> = {
  government: 'dashboard',
  supplier: 'dashboard',
  citizen: 'dashboard',
  auditor: 'dashboard',
  oversight: 'dashboard',
};

function AppContent() {
  const [activePhase, setActivePhase] = useState<string>('dashboard');
  const [tenders, setTenders] = useState<any[]>([]);
  const [bids, setBids] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [blockchainRecords, setBlockchainRecords] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reputationScores, setReputationScores] = useState<any[]>([]);
  const [registeredSuppliers, setRegisteredSuppliers] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load shared state from Firebase on mount
  useEffect(() => {
    loadSharedState().then((data) => {
      if (data) {
        if (data.tenders) setTenders(data.tenders);
        if (data.bids) setBids(data.bids);
        if (data.contracts) setContracts(data.contracts);
        if (data.blockchainRecords) setBlockchainRecords(data.blockchainRecords);
        if (data.disputes) setDisputes(data.disputes);
        if (data.reports) setReports(data.reports);
        if (data.reputationScores) setReputationScores(data.reputationScores);
        if (data.registeredSuppliers) setRegisteredSuppliers(data.registeredSuppliers);
      }
      setLoaded(true);
    });
  }, []);

  // Save to Firebase on any change (only after initial load)
  useEffect(() => {
    if (!loaded) return;
    saveSharedState({ tenders, bids, contracts, blockchainRecords, disputes, reports, reputationScores, registeredSuppliers });
  }, [tenders, bids, contracts, blockchainRecords, disputes, reports, reputationScores, registeredSuppliers, loaded]);
  const loadDemoData = useCallback(() => {
    const data = generateDemoData();
    setTenders(data.tenders);
    setBids(data.bids);
    setContracts(data.contracts);
    setBlockchainRecords(data.blockchainRecords);
    setDisputes(data.disputes);
    setReports(data.reports);
    setReputationScores(data.reputationScores);
    setRegisteredSuppliers(data.registeredSuppliers);
  }, []);

  const { t, language, setLanguage, dir } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('citizen');
  const [onChainRole, setOnChainRole] = useState<UserRole | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const tablistRef = useRef<HTMLDivElement>(null);
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const FONT_SIZES = [14, 16, 18, 20];
  const [fontSizeIdx, setFontSizeIdx] = useState(1); // default 16px

  const [showAccessibility, setShowAccessibility] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('darkMode') === 'true'; } catch { return false; }
  });
  // Pending state for accessibility panel — only applied on confirm
  const [pendingHighContrast, setPendingHighContrast] = useState(false);
  const [pendingDarkMode, setPendingDarkMode] = useState(false);
  const [pendingFontSizeIdx, setPendingFontSizeIdx] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SIZES[fontSizeIdx]}px`;
  }, [fontSizeIdx]);

  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [highContrast]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Ctrl+K / Cmd+K to focus search bar
  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleSearchShortcut);
    return () => document.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    if (!searchFocused) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchFocused]);

  const getSearchResults = () => {
    const q = searchQuery.toLowerCase().trim();
    if (!q || q.length < 2) return [];
    const results: { type: string; title: string; subtitle: string; tab: string; icon: any }[] = [];

    tenders.forEach((tender: any) => {
      if (
        tender.title?.toLowerCase().includes(q) ||
        tender.department?.toLowerCase().includes(q) ||
        tender.id?.toLowerCase().includes(q) ||
        tender.category?.toLowerCase().includes(q)
      ) {
        results.push({
          type: t('search.tender'),
          title: tender.title || tender.id,
          subtitle: `${tender.department || ''} • ${tender.status || ''}`,
          tab: 'pre',
          icon: FileText,
        });
      }
    });

    bids.forEach((bid: any) => {
      if (
        bid.vendorName?.toLowerCase().includes(q) ||
        bid.tenderId?.toLowerCase().includes(q) ||
        bid.vendorEmail?.toLowerCase().includes(q)
      ) {
        results.push({
          type: t('search.bid'),
          title: bid.vendorName || bid.tenderId,
          subtitle: `${bid.tenderId || ''} • ${bid.amount ? `${Number(bid.amount).toLocaleString()} AFN` : ''}`,
          tab: 'tender',
          icon: Send,
        });
      }
    });

    contracts.forEach((contract: any) => {
      if (
        contract.vendorName?.toLowerCase().includes(q) ||
        contract.title?.toLowerCase().includes(q) ||
        contract.id?.toLowerCase().includes(q)
      ) {
        results.push({
          type: t('search.contract'),
          title: contract.title || contract.vendorName || contract.id,
          subtitle: `${contract.vendorName || ''} • ${contract.status || ''}`,
          tab: 'post',
          icon: Briefcase,
        });
      }
    });

    reports.forEach((report: any) => {
      if (
        report.title?.toLowerCase().includes(q) ||
        report.description?.toLowerCase().includes(q) ||
        report.category?.toLowerCase().includes(q)
      ) {
        results.push({
          type: t('search.report'),
          title: report.title || report.category,
          subtitle: `${report.category || ''} • ${report.status || ''}`,
          tab: 'whistleblower',
          icon: AlertTriangle,
        });
      }
    });

    registeredSuppliers.forEach((supplier: any) => {
      if (
        supplier.companyName?.toLowerCase().includes(q) ||
        supplier.email?.toLowerCase().includes(q) ||
        supplier.licenseNumber?.toLowerCase().includes(q)
      ) {
        results.push({
          type: t('search.supplier'),
          title: supplier.companyName || supplier.email,
          subtitle: `${supplier.email || ''} • ${supplier.licenseNumber || ''}`,
          tab: 'supplier',
          icon: Truck,
        });
      }
    });

    return results.slice(0, 10);
  };

  const { connected, account, procurementContract, isCorrectNetwork, connect } = useWeb3();

  // Fetch role from smart contract when wallet connects
  useEffect(() => {
    if (!connected || !procurementContract || !account || !isCorrectNetwork) {
      setOnChainRole(null);
      return;
    }
    (async () => {
      try {
        const roleNum = await procurementContract.getRole(account);
        const role = ROLE_MAP[Number(roleNum)];
        if (role) {
          setOnChainRole(role);
          setUserRole(role);
          setShowRoleModal(false);
        } else {
          setOnChainRole(null);
          setShowRoleModal(true);
        }
      } catch {
        setOnChainRole(null);
        setUserRole('citizen');
      }
    })();
  }, [connected, account, procurementContract, isCorrectNetwork]);

  const handleRegisterRole = async (roleNum: number) => {
    if (!procurementContract) return;
    setRoleLoading(true);
    try {
      const tx = await procurementContract.registerRole(roleNum);
      await tx.wait();
      const role = ROLE_MAP[roleNum];
      if (role) {
        setOnChainRole(role);
        setUserRole(role);
        setShowRoleModal(false);
      }
    } catch (err: any) {
      alert(err?.reason || err?.message || 'Registration failed');
    } finally {
      setRoleLoading(false);
    }
  };

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
        <div className="topbar-inner max-w-7xl mx-auto flex items-center justify-between" style={{ padding: '10px 22px', height: 64 }}>
          {/* Left: Logo + Platform name */}
          <div className="flex items-center" style={{ gap: 11, minWidth: 0, flexShrink: 1 }}>
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
              <div className="text-white" style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{t('app.title')}</div>
              <div style={{ fontSize: 11, color: '#c7d3e0', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>{t('app.subtitle')}</div>
            </div>
          </div>

          {/* Right: Role switcher + utilities */}
          <div className="header-controls flex items-center" style={{ gap: 6 }}>
            <nav aria-label={t('role.switchRole')} className="role-switch flex" style={{ gap: 6, background: 'rgba(255,255,255,.08)', padding: 4, borderRadius: 999 }}>
              {ALL_ROLES.map((role) => {
                const allowedRole = onChainRole ?? 'citizen';
                // Public (citizen) is ALWAYS accessible; other roles require wallet auth
                const isDisabled = connected && role !== 'citizen' && role !== allowedRole;
                const isActive = userRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => {
                      if (isDisabled) return;
                      setUserRole(role);
                      setActivePhase(roleFirstTab[role]);
                    }}
                    title={isDisabled ? t('role.roleLocked') : undefined}
                    style={{
                      border: 'none',
                      background: isActive ? '#c99a3c' : 'transparent',
                      color: isActive ? '#0f2942' : '#dbe4ee',
                      padding: connected ? '5px 7px' : '6px 10px',
                      borderRadius: 999,
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap' as const,
                      transition: '.15s',
                      opacity: isDisabled ? 0.35 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    className="focus:outline-none focus:ring-2 focus:ring-white focus:ring-inset"
                    onMouseEnter={(e) => { if (!isActive && !isDisabled) (e.target as HTMLElement).style.background = 'rgba(255,255,255,.10)'; }}
                    onMouseLeave={(e) => { if (!isActive) (e.target as HTMLElement).style.background = 'transparent'; }}
                  >
                    {isDisabled && <Lock style={{ width: 11, height: 11, opacity: 0.7 }} />}
                    {t(`role.${role}`)}
                    {isActive && connected && (
                      <span style={{ marginLeft: 2, fontSize: '9px', verticalAlign: 'super', color: '#065f46' }}>●</span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Language Switcher */}
            <div>
              <button
                ref={langBtnRef}
                onClick={() => setShowLangMenu(!showLangMenu)}
                aria-expanded={showLangMenu}
                aria-haspopup="true"
                className="flex items-center gap-1.5 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-white"
                style={{ color: showLangMenu ? '#fff' : '#c7d3e0', padding: '5px 8px', fontSize: '12px', fontWeight: 600, background: showLangMenu ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.06)', borderRadius: 6 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.15)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { if (!showLangMenu) { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.color = '#c7d3e0'; } }}
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

            {/* Accessibility */}
            <button
              onClick={() => { setPendingHighContrast(highContrast); setPendingDarkMode(darkMode); setPendingFontSizeIdx(fontSizeIdx); setShowAccessibility(true); }}
              className="flex items-center gap-1.5 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-white"
              style={{ color: '#c7d3e0', padding: '5px 8px', fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,.06)', borderRadius: 6 }}
              aria-label={t('a11y.title')}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.15)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.color = '#c7d3e0'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 1.5c4.69 0 8.5 3.81 8.5 8.5s-3.81 8.5-8.5 8.5S3.5 16.69 3.5 12 7.31 3.5 12 3.5zM12 6a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-4.5 4.25c-.41 0-.75.34-.75.75s.34.75.75.75h2.75v2.75l-1.5 3.25c-.17.38 0 .83.38 1 .38.17.83 0 1-.38L12 14.88l1.88 3.25c.17.38.62.55 1 .38.38-.17.55-.62.38-1l-1.5-3.25v-2.75h2.75c.41 0 .75-.34.75-.75s-.34-.75-.75-.75h-9z"/>
              </svg>
              <span>{t('a11y.title')}</span>
            </button>

            {/* Help */}
            <button
              onClick={() => { setActivePhase('help'); setShowLangMenu(false); }}
              className="flex items-center gap-1.5 rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-white"
              style={{ color: activePhase === 'help' ? '#fff' : '#c7d3e0', padding: '5px 8px', fontSize: '12px', fontWeight: 600, background: activePhase === 'help' ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.06)', borderRadius: 6 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.15)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { if (activePhase !== 'help') { e.currentTarget.style.background = 'rgba(255,255,255,.06)'; e.currentTarget.style.color = '#c7d3e0'; } }}
            >
              <HelpCircle className="w-4 h-4" />
              <span>{t('nav.help')}</span>
            </button>

            {/* Blockchain Wallet Connection */}
            <Web3Status />

          </div>
        </div>
      </header>

      {/* ── Tab Strip (Light, sticky below navy bar) ── */}
      <div className="tab-strip-container sticky z-[60]" style={{ top: 64, background: '#fcfcfb', borderBottom: '1px solid rgba(11,11,11,0.10)' }}>
        <div className="max-w-7xl mx-auto" style={{ padding: '0 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div
              ref={tablistRef}
              role="tablist"
              aria-label={t('nav.tablistLabel')}
              className="tab-strip-scroll flex overflow-x-auto" style={{ gap: 2, flex: 1 }}
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
                    onClick={() => { setActivePhase(tab.id); }}
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

            {/* Search — right end of tab strip */}
            <div ref={searchContainerRef} style={{ position: 'relative', flexShrink: 0, marginLeft: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: searchFocused ? '#fff' : '#f3f4f6',
                border: `1.5px solid ${searchFocused ? '#c99a3c' : 'transparent'}`,
                borderRadius: 8, padding: '5px 10px',
                boxShadow: searchFocused ? '0 0 0 3px rgba(201, 154, 60, 0.10)' : 'none',
                transition: 'all .15s',
                width: searchFocused ? 280 : 180,
              }}>
                <Search style={{ width: 15, height: 15, color: '#9ca3af', flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setSearchFocused(false); searchInputRef.current?.blur(); setSearchQuery(''); } }}
                  placeholder={t('search.title')}
                  aria-label={t('search.title')}
                  style={{
                    flex: 1, border: 'none', outline: 'none', fontSize: '12.5px',
                    color: '#0f2942', background: 'transparent', minWidth: 0,
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex' }}
                    aria-label="Clear search"
                  >
                    <X style={{ width: 14, height: 14, color: '#9ca3af' }} />
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchFocused && searchQuery.length >= 2 && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, width: 400, marginTop: 6,
                  background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb',
                  boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 200,
                  maxHeight: 360, overflowY: 'auto',
                }}>
                  {getSearchResults().length === 0 ? (
                    <div style={{ padding: '24px 18px', textAlign: 'center' }}>
                      <Search style={{ width: 28, height: 28, color: '#d1d5db', margin: '0 auto 8px' }} />
                      <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 2px', fontWeight: 600 }}>{t('search.noResults')}</p>
                      <p style={{ color: '#9ca3af', fontSize: '12px', margin: 0 }}>{t('search.tryDifferent')}</p>
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: '8px 14px 4px', fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {getSearchResults().length} {t('search.resultsFound')}
                      </div>
                      {getSearchResults().map((result, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setActivePhase(result.tab);
                            setSearchFocused(false);
                            setSearchQuery('');
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                            padding: '9px 14px', border: 'none', background: 'transparent',
                            cursor: 'pointer', textAlign: 'start',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, background: '#f3f4f6',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <result.icon style={{ width: 15, height: 15, color: '#6b7280' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f2942', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.title}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.subtitle}</div>
                          </div>
                          <span style={{
                            fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                            background: '#eff6ff', color: '#1d4ed8', flexShrink: 0,
                          }}>{result.type}</span>
                          <ArrowRight style={{ width: 14, height: 14, color: '#d1d5db', flexShrink: 0 }} />
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Mode Banner */}
      <div style={{
        background: connected
          ? 'linear-gradient(90deg, #d1fae5 0%, #ecfdf5 100%)'
          : 'linear-gradient(90deg, #fef3cd 0%, #fef9e7 100%)',
        borderBottom: connected ? '1px solid #a7f3d0' : '1px solid #f0dcae',
        padding: '10px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}>
        <Activity style={{ width: 16, height: 16, color: connected ? '#065f46' : '#92400e' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: connected ? '#065f46' : '#78350f', flex: 1, textAlign: 'center' }}>
          {connected ? t('app.blockchainBanner') : t('app.simulationBanner')}
        </span>
        {tenders.length === 0 && (
          <button
            onClick={loadDemoData}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#0f2942', color: '#fff', border: 'none', borderRadius: 8,
              padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            <Database style={{ width: 13, height: 13 }} />
            {t('app.loadDemoData')}
          </button>
        )}
      </div>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
        {activePhase === 'dashboard' && (
          <ProcurementDashboard
            setActivePhase={setActivePhase}
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
            setTenders={setTenders}
            bids={bids}
            setBids={setBids}
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
            reputationScores={reputationScores}
            userRole={userRole}
            registeredSuppliers={registeredSuppliers}
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
            reports={reports}
            setReports={setReports}
            disputes={disputes}
            setDisputes={setDisputes}
            userRole={userRole}
          />
        )}
        {activePhase === 'audit' && (
          <PublicAuditDashboard
            tenders={tenders}
            bids={bids}
            contracts={contracts}
            blockchainRecords={blockchainRecords}
            userRole={userRole}
            disputes={disputes}
            reports={reports}
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
            reports={reports}
            setReports={setReports}
          />
        )}
        {activePhase === 'whistleblower' && (
          <WhistleblowerPortal
            reports={reports}
            setReports={setReports}
            tenders={tenders}
            contracts={contracts}
            disputes={disputes}
            setDisputes={setDisputes}
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
            userRole={userRole}
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
        {activePhase === 'register' && (
          <RegisterKYC
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
            userRole={userRole}
            registeredSuppliers={registeredSuppliers}
            setRegisteredSuppliers={setRegisteredSuppliers}
          />
        )}
        {activePhase === 'submitBid' && (
          <SubmitBid
            tenders={tenders}
            bids={bids}
            setBids={setBids}
            setBlockchainRecords={setBlockchainRecords}
            blockchainRecords={blockchainRecords}
            registeredSuppliers={registeredSuppliers}
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

      {/* Role Registration Modal */}
      {showRoleModal && connected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.5)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#0f2942' }}>{t('role.registerTitle')}</h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>{t('role.registerDesc')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                onClick={() => handleRegisterRole(1)}
                disabled={roleLoading}
                style={{ padding: '14px 20px', borderRadius: 10, border: '2px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f2942' }}>{t('role.citizen')}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t('role.citizenDesc')}</div>
              </button>
              <button
                onClick={() => handleRegisterRole(2)}
                disabled={roleLoading}
                style={{ padding: '14px 20px', borderRadius: 10, border: '2px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f2942' }}>{t('role.supplier')}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t('role.supplierDesc')}</div>
              </button>
            </div>
            {roleLoading && <p style={{ marginTop: 16, fontSize: 13, color: '#c99a3c', fontWeight: 600 }}>{t('role.registering')}</p>}
            <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>{t('role.privilegedNote')}</p>
          </div>
        </div>
      )}

      {/* Accessibility Panel — slide-in from top right */}
      {showAccessibility && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAccessibility(false); }}
        >
          <div style={{
            position: 'absolute', top: 0, right: 0,
            background: '#fff',
            width: 420, maxWidth: '100vw',
            maxHeight: '100vh', overflowY: 'auto',
            boxShadow: '-4px 0 24px rgba(0,0,0,.15)',
            borderLeft: '1px solid #e5e7eb',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px 0',
            }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f2942' }}>
                {t('a11y.title')}
              </h2>
              <button
                onClick={() => setShowAccessibility(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}
                aria-label="Close"
              >
                <X style={{ width: 22, height: 22, color: '#6b7280' }} />
              </button>
            </div>

            <div style={{ padding: '16px 24px 24px' }}>
              {/* Intro */}
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginTop: 0, marginBottom: 4 }}>
                {t('a11y.intro')}
              </p>
              <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginTop: 0 }}>
                {t('a11y.moreGuides')}{' '}
                <a
                  href="https://mcmw.abilitynet.org.uk/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#1d4ed8', textDecoration: 'underline', fontWeight: 600 }}
                >
                  mcmw.abilitynet.org.uk
                </a>
              </p>

              {/* Text Size Section */}
              <h3 style={{ fontSize: 17, fontWeight: 600, color: '#1d4ed8', marginBottom: 12, marginTop: 20 }}>
                {t('a11y.textSize')}
              </h3>
              <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginTop: 0, marginBottom: 12 }}>
                {t('a11y.textSizeDesc')}
              </p>

              {/* Contrast Section */}
              <h3 style={{ fontSize: 17, fontWeight: 600, color: '#1d4ed8', marginBottom: 12, marginTop: 24 }}>
                {t('a11y.contrast')}
              </h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setPendingHighContrast(false); setPendingDarkMode(false); }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px', borderRadius: 8, cursor: 'pointer',
                    border: !pendingHighContrast && !pendingDarkMode ? '2px solid #059669' : '1.5px solid #d1d5db',
                    background: !pendingHighContrast && !pendingDarkMode ? '#ecfdf5' : '#fff',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${!pendingHighContrast && !pendingDarkMode ? '#059669' : '#d1d5db'}`,
                    background: !pendingHighContrast && !pendingDarkMode ? '#059669' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {!pendingHighContrast && !pendingDarkMode && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f2942' }}>{t('a11y.defaultSettings')}</span>
                </button>
                <button
                  onClick={() => { setPendingHighContrast(true); setPendingDarkMode(false); }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px', borderRadius: 8, cursor: 'pointer',
                    border: pendingHighContrast ? '2px solid #ffd700' : '1.5px solid #d1d5db',
                    background: '#111',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${pendingHighContrast ? '#ffd700' : '#555'}`,
                    background: pendingHighContrast ? '#ffd700' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {pendingHighContrast && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#ffd700' }}>{t('a11y.highContrast')}</span>
                </button>
              </div>

              {/* Dark Mode Section */}
              <h3 style={{ fontSize: 17, fontWeight: 600, color: '#1d4ed8', marginBottom: 12, marginTop: 24 }}>
                Dark Mode
              </h3>
              <button
                onClick={() => { const next = !pendingDarkMode; setPendingDarkMode(next); if (next) setPendingHighContrast(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 8, cursor: 'pointer',
                  border: pendingDarkMode ? '2px solid #6366f1' : '1.5px solid #d1d5db',
                  background: pendingDarkMode ? '#1e1b4b' : '#fff',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${pendingDarkMode ? '#6366f1' : '#d1d5db'}`,
                  background: pendingDarkMode ? '#6366f1' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {pendingDarkMode && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: pendingDarkMode ? '#a5b4fc' : '#0f2942' }}>
                  {pendingDarkMode ? 'Dark Mode Enabled' : 'Enable Dark Mode'}
                </span>
              </button>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button
                  onClick={() => { setPendingFontSizeIdx(1); setPendingHighContrast(false); setPendingDarkMode(false); }}
                  style={{
                    flex: 1, padding: '11px 20px', borderRadius: 8,
                    border: '1.5px solid #1d4ed8', background: 'transparent',
                    color: '#1d4ed8',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                  }}
                >
                  {t('a11y.resetDefault')}
                </button>
                <button
                  onClick={() => { setHighContrast(pendingHighContrast); setDarkMode(pendingDarkMode); setFontSizeIdx(pendingFontSizeIdx); setShowAccessibility(false); }}
                  style={{
                    flex: 1, padding: '11px 20px', borderRadius: 8,
                    border: 'none', background: '#1d4ed8',
                    color: '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                  }}
                >
                  {t('a11y.confirmChoice')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

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
