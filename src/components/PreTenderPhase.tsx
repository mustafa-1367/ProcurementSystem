import { useState } from 'react';
import { Plus, Upload, FileText, Calendar, Banknote, Building, Shield, CheckCircle } from 'lucide-react';
import { addProcurementRecordAsync } from '../utils/blockchain';
import { sendInvitationEmail } from '../utils/emailNotify';
import { useTranslation } from '../utils/i18n';
import { useWeb3 } from '../utils/useWeb3';
import { TxHashLink } from './TxHashLink';

interface InvitedBidder {
  name: string;
  email: string;
}

interface PreTenderPhaseProps {
  tenders: any[];
  setTenders: (tenders: any[]) => void;
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
  registeredSuppliers: any[];
}

export function PreTenderPhase({ tenders, setTenders, setBlockchainRecords, blockchainRecords, registeredSuppliers }: PreTenderPhaseProps) {
  const { connected, connect } = useWeb3();
  const [confirmation, setConfirmation] = useState<{ onChain: boolean; hash: string; tenderTitle: string; action: 'created' | 'published' } | null>(null);
  const [publishingTenderId, setPublishingTenderId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [fundConfirmed, setFundConfirmed] = useState(false);
  const [methodSelected, setMethodSelected] = useState(false);
  const [fundData, setFundData] = useState({ estimatedValue: '', budgetLine: '' });
  const [methodData, setMethodData] = useState({ method: 'Open Bidding', singleSourceJustification: '' });
  // Restricted Bidding (Art. 3(9)) invited-bidders list: picked from already
  // e-KYC-registered suppliers (verified email on file) plus a manual
  // name+email fallback for genuine outreach to not-yet-registered companies.
  const [selectedInvitees, setSelectedInvitees] = useState<Set<string>>(new Set());
  const [manualInvitees, setManualInvitees] = useState<InvitedBidder[]>([]);
  const [manualInviteDraft, setManualInviteDraft] = useState({ name: '', email: '' });

  const toggleInvitee = (companyName: string) => {
    setSelectedInvitees((prev) => {
      const next = new Set(prev);
      if (next.has(companyName)) next.delete(companyName);
      else next.add(companyName);
      return next;
    });
  };

  const addManualInvitee = () => {
    if (!manualInviteDraft.name.trim() || !manualInviteDraft.email.trim()) return;
    setManualInvitees((prev) => [...prev, { name: manualInviteDraft.name.trim(), email: manualInviteDraft.email.trim() }]);
    setManualInviteDraft({ name: '', email: '' });
  };

  const removeManualInvitee = (email: string) => {
    setManualInvitees((prev) => prev.filter((m) => m.email !== email));
  };

  const getInvitedBidders = (): InvitedBidder[] => {
    const fromRegistered: InvitedBidder[] = registeredSuppliers
      .filter((s: any) => selectedInvitees.has(s.companyName))
      .map((s: any) => ({ name: s.companyName, email: s.email }));
    return [...fromRegistered, ...manualInvitees];
  };
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    budget: '',
    category: '',
    deadline: '',
    requirements: '',
    procurementType: '',
  });
  const { t } = useTranslation();

  const getMinimumDays = (method: string): { min: number; max: number | null; label: string } => {
    switch (method) {
      case 'Single-Source':
        return { min: 1, max: 7, label: '1–7 days (emergency only)' };
      case 'Restricted Bidding':
        return { min: 7, max: 14, label: '7–14 days' };
      case 'Request for Quotations':
        return { min: 7, max: null, label: 'Minimum 7 days' };
      case 'Open Bidding':
        return { min: 21, max: null, label: 'Minimum 21 days' };
      case 'QCBS (Consulting)':
        return { min: 21, max: null, label: 'Minimum 21 days' };
      default:
        return { min: 21, max: null, label: 'Minimum 21 days' };
    }
  };

  const deadlineRule = getMinimumDays(methodData.method);
  const todayDate = new Date();
  const minDeadlineDate = new Date(todayDate.getTime() + deadlineRule.min * 24 * 60 * 60 * 1000);
  const minDeadlineStr = minDeadlineDate.toISOString().split('T')[0];
  const maxDeadlineDate = deadlineRule.max ? new Date(todayDate.getTime() + deadlineRule.max * 24 * 60 * 60 * 1000) : null;
  const maxDeadlineStr = maxDeadlineDate ? maxDeadlineDate.toISOString().split('T')[0] : undefined;

  const deadlineDaysFromNow = formData.deadline
    ? Math.ceil((new Date(formData.deadline).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const deadlineTooShort = formData.deadline && deadlineDaysFromNow < deadlineRule.min;
  const deadlineTooLong = formData.deadline && deadlineRule.max && deadlineDaysFromNow > deadlineRule.max;
  const deadlineInvalid = deadlineTooShort || deadlineTooLong;

  const handleConfirmFund = () => {
    if (!fundData.estimatedValue || !fundData.budgetLine) return;
    setFundConfirmed(true);
    setFormData({ ...formData, budget: fundData.estimatedValue });
    setCurrentStep(2);
  };

  const RFQ_THRESHOLD_AFN = 500000;
  // Budget is stored and displayed with thousands separators (consistent
  // with how tender.budget is already treated everywhere downstream — see
  // the parseBudget() helper duplicated in TenderingPhase/SubmitBid/
  // PublicAuditDashboard, which all strip commas before doing math).
  // formatThousands re-derives the display string from digits only on every
  // keystroke, so pasting or backspacing mid-number still produces a valid
  // grouped number instead of a stuck or malformed one.
  const parseBudget = (v: string) => Number(String(v).replace(/,/g, ''));
  const formatThousands = (v: string) => {
    const digits = v.replace(/[^\d]/g, '');
    return digits ? Number(digits).toLocaleString('en-US') : '';
  };

  const handleSelectMethod = () => {
    if (methodData.method === 'Single-Source' && !methodData.singleSourceJustification) return;
    // Art. 3(9): Restricted Tendering means "a limited number of bidders are invited" —
    // require the invited list before the method can be confirmed.
    if (methodData.method === 'Restricted Bidding' && getInvitedBidders().length === 0) return;
    // Procurement Procedures Rule 19(1): RFQ only usable when estimated value does not
    // exceed the Art. 63/NPA-set threshold (500,000 AFN).
    if (methodData.method === 'Request for Quotations' && parseBudget(fundData.estimatedValue) > RFQ_THRESHOLD_AFN) return;
    setMethodSelected(true);
    setCurrentStep(3);
  };

  const resetCreateFlow = () => {
    setShowCreateForm(false);
    setCurrentStep(1);
    setFundConfirmed(false);
    setMethodSelected(false);
    setFundData({ estimatedValue: '', budgetLine: '' });
    setMethodData({ method: 'Open Bidding', singleSourceJustification: '' });
    setSelectedInvitees(new Set());
    setManualInvitees([]);
    setManualInviteDraft({ name: '', email: '' });
    setFormData({ title: '', description: '', department: '', budget: '', category: '', deadline: '', requirements: '', procurementType: '' });
  };

  const handleCreateTender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deadlineInvalid) return;

    const newTender = {
      id: `TND-${Date.now()}`,
      ...formData,
      method: methodData.method,
      invitedBidders: methodData.method === 'Restricted Bidding' ? getInvitedBidders() : null,
      procurementType: formData.procurementType,
      budgetLine: fundData.budgetLine,
      status: 'draft',
      createdAt: new Date().toISOString(),
      publishedAt: null,
    };

    const { block, contract, onChain } = await addProcurementRecordAsync('tender', {
      title: formData.title,
      budget: formData.budget,
      deadline: formData.deadline,
      department: formData.department,
      localTenderId: newTender.id,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'tender_created',
      tenderId: newTender.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain, simulated: !onChain, onChain,
    };

    // Persist the real on-chain tender ID onto the tender record itself —
    // not just blockchain.ts's in-memory cache — so Publish and every bid
    // committed against this tender can address the real on-chain record
    // directly instead of guessing or silently recreating it later.
    const onChainTenderId = (contract?.data as any)?.onChainTenderId as string | undefined;
    setTenders([...tenders, onChain && onChainTenderId ? { ...newTender, onChainTenderId } : newTender]);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setConfirmation({ onChain, hash: contract.transactionHash, tenderTitle: newTender.title, action: 'created' });
    resetCreateFlow();
  };

  const publishTender = async (tenderId: string) => {
    // Re-entrancy guard — this whole function is async (invitation emails
    // are sent over the network before the tender's status ever flips to
    // 'published', which is the only thing that would normally make the
    // Publish button disappear). Without this, a few clicks while it's
    // still in flight re-runs the entire invitation batch each time —
    // exactly how a Restricted Bidding invitee ended up with 3 copies of
    // the same invitation email for one publish.
    if (publishingTenderId) return;
    setPublishingTenderId(tenderId);
    try {
      const tender = tenders.find((td) => td.id === tenderId);

      // Art. 3(9): send the actual invitation to each invited bidder once the
      // Restricted Bidding tender goes live — not just a passive listing.
      let invitationResults: { name: string; status: string; error?: string }[] = [];
      if (tender.method === 'Restricted Bidding' && Array.isArray(tender.invitedBidders)) {
        invitationResults = await Promise.all(
          tender.invitedBidders.map(async (invitee: InvitedBidder) => {
            const result = await sendInvitationEmail({
              vendorEmail: invitee.email,
              vendorName: invitee.name,
              tenderTitle: tender.title,
              deadline: tender.deadline,
            });
            return { name: invitee.name, status: result.status, error: (result as any).error };
          })
        );
      }

      const updatedTenders = tenders.map((td) =>
        td.id === tenderId
          ? { ...td, status: 'published', publishedAt: new Date().toISOString(), invitationEmailResults: invitationResults.length ? invitationResults : undefined }
          : td
      );

      const { block, contract, onChain } = await addProcurementRecordAsync('tender', {
        action: 'publish',
        tenderId,
        title: tender.title,
        budget: tender.budget,
        deadline: tender.deadline,
        // Pass through whatever was already persisted at creation time —
        // onChainPublishTender prefers this over its own in-memory cache,
        // so publishing still addresses the right on-chain tender after a
        // reload. If this tender was created without a wallet connected
        // (so there's nothing to pass), onChainPublishTender creates it
        // for real right now instead of leaving that cost for the first
        // bidder to silently inherit.
        onChainTenderId: tender.onChainTenderId,
      });

      const blockchainRecord = {
        id: block.hash,
        type: 'tender_published',
        tenderId,
        contractId: contract.id,
        transactionHash: contract.transactionHash,
        timestamp: new Date().toISOString(),
        verified: onChain, simulated: !onChain, onChain,
      };

      // Capture the on-chain ID whether it was already known or had to be
      // created just now by onChainPublishTender's own fallback.
      const publishedOnChainTenderId = (contract?.data as any)?.onChainTenderId as string | undefined;
      setTenders(onChain && publishedOnChainTenderId
        ? updatedTenders.map((td) => (td.id === tenderId ? { ...td, onChainTenderId: publishedOnChainTenderId } : td))
        : updatedTenders);
      setBlockchainRecords([...blockchainRecords, blockchainRecord]);
      setConfirmation({ onChain, hash: contract.transactionHash, tenderTitle: tender.title, action: 'published' });
    } finally {
      setPublishingTenderId(null);
    }
  };

  const categories = [
    { value: 'Infrastructure', label: t('preTender.categories.infrastructure') },
    { value: 'IT & Technology', label: t('preTender.categories.it') },
    { value: 'Healthcare', label: t('preTender.categories.healthcare') },
    { value: 'Education', label: t('preTender.categories.education') },
    { value: 'Defense', label: t('preTender.categories.defense') },
    { value: 'Agriculture', label: t('preTender.categories.agriculture') },
    { value: 'Transportation', label: t('preTender.categories.transportation') },
  ];

  const departments = [
    { value: 'Ministry of Finance', label: t('preTender.departments.finance') },
    { value: 'Ministry of Public Works', label: t('preTender.departments.publicWorks') },
    { value: 'Ministry of Public Health', label: t('preTender.departments.health') },
    { value: 'Ministry of Education', label: t('preTender.departments.education') },
    { value: 'Ministry of Higher Education', label: t('preTender.departments.higherEducation') },
    { value: 'Ministry of Defense', label: t('preTender.departments.defense') },
    { value: 'Ministry of Interior Affairs', label: t('preTender.departments.interior') },
    { value: 'Ministry of Agriculture, Irrigation and Livestock', label: t('preTender.departments.agriculture') },
    { value: 'Ministry of Urban Development and Land', label: t('preTender.departments.urbanDevelopment') },
    { value: 'Ministry of Energy and Water', label: t('preTender.departments.energyWater') },
    { value: 'Ministry of Mines and Petroleum', label: t('preTender.departments.mines') },
    { value: 'Ministry of Communications and Information Technology', label: t('preTender.departments.ict') },
    { value: 'Ministry of Transport and Civil Aviation', label: t('preTender.departments.transport') },
    { value: 'Ministry of Commerce and Industry', label: t('preTender.departments.commerce') },
    { value: 'Ministry of Rural Rehabilitation and Development', label: t('preTender.departments.ruralDevelopment') },
    { value: 'Ministry of Labor and Social Affairs', label: t('preTender.departments.labor') },
    { value: 'Ministry of Justice', label: t('preTender.departments.justice') },
    { value: 'Ministry of Foreign Affairs', label: t('preTender.departments.foreignAffairs') },
    { value: 'Ministry of Economy', label: t('preTender.departments.economy') },
    { value: 'Ministry of Information and Culture', label: t('preTender.departments.infoCulture') },
    { value: 'Ministry of Refugees and Repatriation', label: t('preTender.departments.refugees') },
    { value: 'National Procurement Authority', label: t('preTender.departments.npa') },
    { value: 'Da Afghanistan Bank', label: t('preTender.departments.centralBank') },
    { value: 'Independent Administrative Reform and Civil Service Commission', label: t('preTender.departments.iarcsc') },
    { value: 'Kabul Municipality', label: t('preTender.departments.kabulMunicipality') },
  ];

  const methods = [
    { value: 'Open Bidding', label: t('preTender.methods.openBidding') },
    { value: 'Restricted Bidding', label: t('preTender.methods.restrictedBidding') },
    { value: 'Request for Quotations', label: t('preTender.methods.rfq') },
    { value: 'Single-Source', label: t('preTender.methods.singleSource') },
    { value: 'QCBS (Consulting)', label: t('preTender.methods.qcbs') },
  ];

  const stepLabels = [
    t('preTender.stepFund'),
    t('preTender.stepMethod'),
    t('preTender.stepDraft'),
    t('preTender.stepCommittee'),
    t('preTender.stepAnnounced'),
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 11px', border: '1px solid #c3c2b7',
    borderRadius: 7, fontSize: '13.5px', fontFamily: 'inherit', background: '#fff',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#52514e', marginBottom: 5,
  };
  const cardStyle: React.CSSProperties = {
    background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18,
  };
  const hintStyle: React.CSSProperties = { fontSize: '11.5px', color: '#6e6c66', marginTop: 4 };
  const btnPrimary: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 8, padding: '9px 15px', fontSize: '13.5px', fontWeight: 700,
    cursor: 'pointer', border: '1px solid transparent', transition: '.15s',
    background: '#0f2942', color: '#fff',
  };
  const btnGold: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 8, padding: '6px 11px', fontSize: '12px', fontWeight: 700,
    cursor: 'pointer', border: '1px solid transparent', transition: '.15s',
    background: '#c99a3c', color: '#0f2942',
  };
  const btnGhost: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 8, padding: '9px 15px', fontSize: '13.5px', fontWeight: 700,
    cursor: 'pointer', border: '1px solid rgba(11,11,11,0.10)', transition: '.15s',
    background: 'transparent', color: '#0b0b0b',
  };
  const confirmedBadge: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 999,
    color: '#0a6b0a', background: '#eaf8ea', border: '1px solid #c7ecc7',
  };

  return (
    <div className="space-y-4">
      {/* Transaction confirmation banner — matches the bidder-registration success pattern */}
      {confirmation && (
        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10, padding: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <CheckCircle style={{ width: 24, height: 24, color: '#065f46', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 4px 0', fontWeight: 700, fontSize: 16, color: '#065f46' }}>
              {confirmation.action === 'created' ? t('preTender.confirmCreatedTitle') : t('preTender.confirmPublishedTitle')}
            </h3>
            <p style={{ margin: '0 0 8px 0', fontSize: 14, color: '#047857' }}>
              <strong>{confirmation.tenderTitle}</strong>{' '}
              {confirmation.action === 'created' ? t('preTender.confirmCreatedBody') : t('preTender.confirmPublishedBody')}{' '}
              {confirmation.onChain ? t('preTender.confirmOnChainSuffix') : t('preTender.confirmSimulatedSuffix')}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {confirmation.onChain ? (
                <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  ● {t('preTender.confirmOnChainBadge')}
                </span>
              ) : (
                <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  ● {t('preTender.confirmSimulatedBadge')}
                </span>
              )}
              {confirmation.onChain && <TxHashLink hash={confirmation.hash} truncate={22} showIcon />}
              {!confirmation.onChain && !connected && (
                <button
                  onClick={connect}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', padding: '4px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  {t('preTender.confirmConnectRetry')}
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => setConfirmation(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280', padding: 4 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('preTender.tenderManagement')}</h1>
          <p style={{ margin: '0 0 10px 0', color: '#52514e' }}>{t('preTender.tenderManagementDesc')}</p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            style={btnPrimary}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#173d61'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#0f2942'; }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            {t('preTender.createNewTender')}
          </button>
        )}
      </div>

      {showCreateForm && (
        <>
          {/* Stepper Card */}
          <div style={cardStyle}>
            <h2 style={{ margin: '0 0 10px 0', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('preTender.requiredSteps')}</h2>
            <div style={{ display: 'flex', gap: 0, margin: '6px 0 4px 0' }}>
              {stepLabels.map((label, idx) => (
                <div key={idx} style={{ flex: 1, textAlign: 'center', position: 'relative', paddingTop: 26 }}>
                  {idx > 0 && (
                    <div style={{
                      position: 'absolute', top: 11, left: '-50%', width: '100%', height: 2, zIndex: 0,
                      background: idx + 1 <= currentStep ? '#0ca30c' : '#e1e0d9',
                    }} />
                  )}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: idx + 1 < currentStep ? '#0ca30c' : idx + 1 === currentStep ? '#2a78d6' : '#e1e0d9',
                    border: `2px solid ${idx + 1 < currentStep ? '#0ca30c' : idx + 1 === currentStep ? '#2a78d6' : '#c3c2b7'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#fff',
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 1,
                  }}>
                    {idx + 1 < currentStep ? '✓' : idx + 1}
                  </div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#52514e' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 1 & Step 2 — Two column layout */}
          <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Step 1 — Cost estimate & fund confirmation */}
            <div style={{ ...cardStyle, opacity: 1 }}>
              <h2 style={{ margin: '0 0 10px 0', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('preTender.step1Title')}</h2>
              <div style={{ marginBottom: 13 }}>
                <label style={labelStyle}>{t('preTender.estimatedValue')}</label>
                <input
                  value={fundData.estimatedValue}
                  onChange={(e) => setFundData({ ...fundData, estimatedValue: formatThousands(e.target.value) })}
                  placeholder={t('preTender.estimatedValuePlaceholder')}
                  inputMode="numeric"
                  disabled={fundConfirmed}
                  style={{ ...inputStyle, background: fundConfirmed ? '#f6f5f2' : '#fff' }}
                />
              </div>
              <div style={{ marginBottom: 13 }}>
                <label style={labelStyle}>{t('preTender.budgetLine')}</label>
                <input
                  value={fundData.budgetLine}
                  onChange={(e) => setFundData({ ...fundData, budgetLine: e.target.value })}
                  placeholder={t('preTender.budgetLinePlaceholder')}
                  disabled={fundConfirmed}
                  style={{ ...inputStyle, background: fundConfirmed ? '#f6f5f2' : '#fff' }}
                />
              </div>
              {!fundConfirmed ? (
                <button
                  onClick={handleConfirmFund}
                  style={btnGold}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#e0b658'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#c99a3c'; }}
                >
                  {t('preTender.confirmFund')}
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={confirmedBadge}>
                    <CheckCircle style={{ width: 14, height: 14 }} /> {t('preTender.fundConfirmed')}
                  </span>
                  {/* Without this, confirming the fund estimate then
                      discovering the chosen method can't actually be
                      selected with that amount (e.g. RFQ's 500,000 AFN cap,
                      Rule 19(1)) was a dead end — the amount field was
                      locked with no way back, and the only reset button
                      lived in Step 3, which is unreachable until a method
                      is confirmed. Unconfirming just unlocks the two
                      fields again; nothing else about the draft is lost. */}
                  <button
                    type="button"
                    onClick={() => setFundConfirmed(false)}
                    style={{ fontSize: '12px', fontWeight: 600, color: '#1c5cab', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    ← Edit amount
                  </button>
                </div>
              )}
              <div style={hintStyle}>{t('preTender.fundHint')}</div>
            </div>

            {/* Step 2 — Method selection */}
            <div style={{ ...cardStyle, opacity: fundConfirmed ? 1 : 0.5, pointerEvents: fundConfirmed ? 'auto' : 'none' }}>
              <h2 style={{ margin: '0 0 10px 0', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('preTender.step2Title')}</h2>
              <div style={{ marginBottom: 13 }}>
                <label style={labelStyle}>{t('preTender.procurementMethod')}</label>
                <select
                  value={methodData.method}
                  onChange={(e) => setMethodData({ ...methodData, method: e.target.value })}
                  disabled={methodSelected}
                  style={{ ...inputStyle, background: methodSelected ? '#f6f5f2' : '#fff' }}
                >
                  {methods.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              {methodData.method === 'Single-Source' && !methodSelected && (
                <div style={{ marginBottom: 13 }}>
                  <label style={labelStyle}>{t('preTender.singleSourceJustification')}</label>
                  <textarea
                    value={methodData.singleSourceJustification}
                    onChange={(e) => setMethodData({ ...methodData, singleSourceJustification: e.target.value })}
                    rows={3}
                    placeholder={t('preTender.singleSourcePlaceholder')}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
              )}
              {methodData.method === 'Restricted Bidding' && !methodSelected && (
                <div style={{ marginBottom: 13 }}>
                  <label style={labelStyle}>Invited bidders</label>

                  {registeredSuppliers.length > 0 ? (
                    <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid rgba(11,11,11,0.15)', borderRadius: 8, padding: 8 }}>
                      {registeredSuppliers.map((s: any) => (
                        <label key={s.companyName} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', cursor: 'pointer', fontSize: '13px' }}>
                          <input
                            type="checkbox"
                            checked={selectedInvitees.has(s.companyName)}
                            onChange={() => toggleInvitee(s.companyName)}
                            style={{ accentColor: '#0f2942' }}
                          />
                          <span style={{ fontWeight: 600, color: '#374151' }}>{s.companyName}</span>
                          <span style={{ color: '#9ca3af', fontSize: '11.5px' }}>{s.email}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div style={hintStyle}>No e-KYC-registered suppliers yet — use "not yet registered" below to invite by name and email.</div>
                  )}

                  <div style={{ marginTop: 10, fontSize: '11.5px', fontWeight: 600, color: '#6e6c66' }}>
                    Invite a company not yet registered:
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <input
                      type="text"
                      value={manualInviteDraft.name}
                      onChange={(e) => setManualInviteDraft({ ...manualInviteDraft, name: e.target.value })}
                      placeholder="Company name"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <input
                      type="email"
                      value={manualInviteDraft.email}
                      onChange={(e) => setManualInviteDraft({ ...manualInviteDraft, email: e.target.value })}
                      placeholder="Email"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button type="button" onClick={addManualInvitee} style={{ ...btnGold, padding: '9px 12px' }}>Add</button>
                  </div>
                  {manualInvitees.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {manualInvitees.map((m) => (
                        <div key={m.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', background: '#f6f5f2', borderRadius: 6, padding: '4px 8px' }}>
                          <span>{m.name} — {m.email}</span>
                          <button type="button" onClick={() => removeManualInvitee(m.email)} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={hintStyle}>Art. 3(9): only invited bidders may submit a bid on this tender. Each invited bidder receives an email invitation when the tender is published.</div>
                </div>
              )}
              {methodData.method === 'Request for Quotations' && !methodSelected && (
                <div style={{ marginBottom: 13 }}>
                  {parseBudget(fundData.estimatedValue) > RFQ_THRESHOLD_AFN ? (
                    <div style={{ fontSize: '12.5px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
                      Estimated value ({parseBudget(fundData.estimatedValue).toLocaleString()} AFN) exceeds the RFQ threshold of {RFQ_THRESHOLD_AFN.toLocaleString()} AFN — Procurement Procedures Rule 19(1) / Art. 63. Use Open Bidding or another method instead.
                    </div>
                  ) : (
                    <div style={hintStyle}>Rule 19(1): usable only up to {RFQ_THRESHOLD_AFN.toLocaleString()} AFN. Rule 19(4): requires quotations from at least 3 sources before award.</div>
                  )}
                </div>
              )}
              <div style={{ ...hintStyle, marginBottom: 10, marginTop: 0 }}>{t('preTender.methodHint')}</div>
              {!methodSelected ? (
                <button
                  onClick={handleSelectMethod}
                  style={btnGold}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#e0b658'; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#c99a3c'; }}
                >
                  {t('preTender.confirmMethod')}
                </button>
              ) : (
                <span style={confirmedBadge}>
                  <CheckCircle style={{ width: 14, height: 14 }} /> {t('preTender.methodConfirmed')}
                </span>
              )}
            </div>
          </div>

          {/* Step 3 — Draft & publish (existing Create Tender form) */}
          {methodSelected && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('preTender.step3Title')}</h2>
                <Shield style={{ width: 20, height: 20, color: '#0ca30c' }} />
              </div>
              <form onSubmit={handleCreateTender}>
                <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                  <div style={{ marginBottom: 13 }}>
                    <label style={labelStyle}>{t('preTender.tenderTitle')}</label>
                    <input
                      required value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder={t('preTender.titlePlaceholder')}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ marginBottom: 13 }}>
                    <label style={labelStyle}>{t('preTender.department')}</label>
                    <select
                      required value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">{t('preTender.selectDepartment')}</option>
                      {departments.map((dept) => (
                        <option key={dept.value} value={dept.value}>{dept.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: 13 }}>
                    <label style={labelStyle}>{t('preTender.category')}</label>
                    <select
                      required value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">{t('preTender.selectCategory')}</option>
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: 13 }}>
                    <label style={labelStyle}>{t('preTender.procurementType')}</label>
                    <select
                      required value={formData.procurementType}
                      onChange={(e) => setFormData({ ...formData, procurementType: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="">{t('preTender.selectProcurementType')}</option>
                      <option value="Goods">{t('preTender.procurementTypes.goods')}</option>
                      <option value="Works">{t('preTender.procurementTypes.works')}</option>
                      <option value="Services">{t('preTender.procurementTypes.services')}</option>
                    </select>
                    <div style={hintStyle}>{t('preTender.procurementTypeHint')}</div>
                  </div>
                  <div style={{ marginBottom: 13 }}>
                    <label style={labelStyle}>{t('preTender.submissionDeadline')}</label>
                    <input
                      type="date" required value={formData.deadline}
                      min={minDeadlineStr}
                      max={maxDeadlineStr}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      style={{ ...inputStyle, borderColor: deadlineInvalid ? '#dc2626' : '#c3c2b7' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: deadlineInvalid ? '#fee2e2' : '#ede9fe',
                        color: deadlineInvalid ? '#991b1b' : '#5b21b6',
                      }}>
                        {methodData.method}: {deadlineRule.label}
                      </span>
                      {formData.deadline && !deadlineInvalid && (
                        <span style={{ fontSize: '11px', color: '#065f46', fontWeight: 600 }}>
                          {deadlineDaysFromNow} days from today
                        </span>
                      )}
                    </div>
                    {deadlineTooShort && (
                      <div style={{ fontSize: '11.5px', color: '#dc2626', marginTop: 3, fontWeight: 600 }}>
                        Deadline too short — {methodData.method} requires at least {deadlineRule.min} days per procurement law.
                      </div>
                    )}
                    {deadlineTooLong && (
                      <div style={{ fontSize: '11.5px', color: '#dc2626', marginTop: 3, fontWeight: 600 }}>
                        Deadline exceeds maximum — {methodData.method} allows up to {deadlineRule.max} days per procurement law.
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginBottom: 13 }}>
                  <label style={labelStyle}>{t('preTender.description')}</label>
                  <textarea
                    required value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3} placeholder={t('preTender.descriptionPlaceholder')}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
                <div style={{ marginBottom: 13 }}>
                  <label style={labelStyle}>{t('preTender.requirements')}</label>
                  <textarea
                    required value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    rows={3} placeholder={t('preTender.requirementsPlaceholder')}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                  <button
                    type="submit"
                    disabled={!!deadlineInvalid}
                    style={{ ...btnPrimary, opacity: deadlineInvalid ? 0.5 : 1, cursor: deadlineInvalid ? 'not-allowed' : 'pointer' }}
                    onMouseEnter={(e) => { if (!deadlineInvalid) (e.target as HTMLElement).style.background = '#173d61'; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#0f2942'; }}
                  >
                    <CheckCircle style={{ width: 16, height: 16 }} />
                    {t('preTender.createRecord')}
                  </button>
                  <button
                    type="button"
                    onClick={resetCreateFlow}
                    style={btnGhost}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#f2f1ee'; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
                  >
                    {t('preTender.cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* My open tenders — table matching Sharakat Chain */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('preTender.myOpenTenders')}</h2>
        </div>
        {tenders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <FileText style={{ width: 48, height: 48, color: '#c3c2b7', margin: '0 auto 12px' }} />
            <p style={{ color: '#6e6c66', fontSize: 14 }}>{t('preTender.noTenders')}</p>
            <p style={{ color: '#6e6c66', fontSize: 13 }}>{t('preTender.getStarted')}</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>{t('preTender.colId')}</th>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>{t('preTender.colTitle')}</th>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>{t('preTender.colStatus')}</th>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}></th>
              </tr>
            </thead>
            <tbody>
              {tenders.map((tender, idx) => (
                <tr key={tender.id} style={{ background: 'transparent' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8f8f6'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ padding: 10, borderBottom: idx === tenders.length - 1 ? 'none' : '1px solid #e1e0d9', fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}>{tender.id}</td>
                  <td style={{ padding: 10, borderBottom: idx === tenders.length - 1 ? 'none' : '1px solid #e1e0d9' }}>
                    <strong>{tender.title}</strong>
                    <br /><span style={{ fontSize: '12.5px', color: '#6e6c66' }}>{tender.department}</span>
                  </td>
                  <td style={{ padding: 10, borderBottom: idx === tenders.length - 1 ? 'none' : '1px solid #e1e0d9' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 999, border: '1px solid',
                      ...(tender.status === 'published'
                        ? { color: '#0a6b0a', background: '#eaf8ea', borderColor: '#c7ecc7' }
                        : { color: '#52514e', background: '#f0efec', borderColor: '#e1e0d9' }),
                    }}>
                      {tender.status === 'published' ? t('preTender.published') : t('preTender.draft')}
                    </span>
                    {' '}
                    {blockchainRecords.some(r => r.tenderId === tender.id && r.onChain) && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>● On-Chain</span>
                    )}
                    {tender.invitationEmailResults && (() => {
                      const sent = tender.invitationEmailResults.filter((r: any) => r.status === 'sent').length;
                      const total = tender.invitationEmailResults.length;
                      const allNotConfigured = tender.invitationEmailResults.every((r: any) => r.status === 'not_configured');
                      return (
                        <span
                          title={tender.invitationEmailResults.map((r: any) => `${r.name}: ${r.status}${r.error ? ` (${r.error})` : ''}`).join(', ')}
                          style={{ display: 'inline-block', marginLeft: 6, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: allNotConfigured ? '#6b7280' : '#065f46', background: allNotConfigured ? '#f3f4f6' : '#d1fae5' }}
                        >
                          {allNotConfigured ? 'Invitations not configured' : `${sent}/${total} invitations sent`}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: 10, borderBottom: idx === tenders.length - 1 ? 'none' : '1px solid #e1e0d9' }}>
                    {tender.status === 'draft' && (
                      <button
                        onClick={() => publishTender(tender.id)}
                        disabled={publishingTenderId === tender.id}
                        style={{
                          ...btnPrimary, padding: '6px 11px', fontSize: '12px',
                          opacity: publishingTenderId === tender.id ? 0.6 : 1,
                          cursor: publishingTenderId === tender.id ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={(e) => { if (publishingTenderId !== tender.id) (e.target as HTMLElement).style.background = '#173d61'; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#0f2942'; }}
                      >
                        <Upload style={{ width: 14, height: 14 }} />
                        {publishingTenderId === tender.id ? 'Publishing…' : t('preTender.publish')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
