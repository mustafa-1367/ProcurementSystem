import { useState } from 'react';
import { Plus, Upload, FileText, Calendar, DollarSign, Building, Shield, CheckCircle } from 'lucide-react';
import { addProcurementRecord } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface PreTenderPhaseProps {
  tenders: any[];
  setTenders: (tenders: any[]) => void;
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
}

export function PreTenderPhase({ tenders, setTenders, setBlockchainRecords, blockchainRecords }: PreTenderPhaseProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [fundConfirmed, setFundConfirmed] = useState(false);
  const [methodSelected, setMethodSelected] = useState(false);
  const [fundData, setFundData] = useState({ estimatedValue: '', budgetLine: '' });
  const [methodData, setMethodData] = useState({ method: 'Open Bidding', singleSourceJustification: '' });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department: '',
    budget: '',
    category: '',
    deadline: '',
    requirements: '',
  });
  const { t } = useTranslation();

  const handleConfirmFund = () => {
    if (!fundData.estimatedValue || !fundData.budgetLine) return;
    setFundConfirmed(true);
    setFormData({ ...formData, budget: fundData.estimatedValue });
    setCurrentStep(2);
  };

  const handleSelectMethod = () => {
    if (methodData.method === 'Single-Source' && !methodData.singleSourceJustification) return;
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
    setFormData({ title: '', description: '', department: '', budget: '', category: '', deadline: '', requirements: '' });
  };

  const handleCreateTender = async (e: React.FormEvent) => {
    e.preventDefault();

    const newTender = {
      id: `TND-${Date.now()}`,
      ...formData,
      method: methodData.method,
      budgetLine: fundData.budgetLine,
      status: 'draft',
      createdAt: new Date().toISOString(),
      publishedAt: null,
    };

    const { block, contract } = addProcurementRecord('tender', {
      title: formData.title,
      budget: formData.budget,
      deadline: formData.deadline,
      department: formData.department,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'tender_created',
      tenderId: newTender.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: true,
    };

    setTenders([...tenders, newTender]);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    resetCreateFlow();
  };

  const publishTender = (tenderId: string) => {
    const updatedTenders = tenders.map((td) =>
      td.id === tenderId ? { ...td, status: 'published', publishedAt: new Date().toISOString() } : td
    );

    const tender = tenders.find((td) => td.id === tenderId);

    const { block, contract } = addProcurementRecord('tender', {
      action: 'publish',
      tenderId,
      title: tender.title,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'tender_published',
      tenderId,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: true,
    };

    setTenders(updatedTenders);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
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
    { value: 'Ministry of Health', label: t('preTender.departments.health') },
    { value: 'Ministry of Education', label: t('preTender.departments.education') },
    { value: 'Ministry of Defense', label: t('preTender.departments.defense') },
    { value: 'Ministry of Agriculture', label: t('preTender.departments.agriculture') },
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
                  onChange={(e) => setFundData({ ...fundData, estimatedValue: e.target.value })}
                  placeholder={t('preTender.estimatedValuePlaceholder')}
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
                <span style={confirmedBadge}>
                  <CheckCircle style={{ width: 14, height: 14 }} /> {t('preTender.fundConfirmed')}
                </span>
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
                    <label style={labelStyle}>{t('preTender.submissionDeadline')}</label>
                    <input
                      type="date" required value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      style={inputStyle}
                    />
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
                    style={btnPrimary}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#173d61'; }}
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
                  </td>
                  <td style={{ padding: 10, borderBottom: idx === tenders.length - 1 ? 'none' : '1px solid #e1e0d9' }}>
                    {tender.status === 'draft' && (
                      <button
                        onClick={() => publishTender(tender.id)}
                        style={{ ...btnPrimary, padding: '6px 11px', fontSize: '12px' }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#173d61'; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#0f2942'; }}
                      >
                        <Upload style={{ width: 14, height: 14 }} />
                        {t('preTender.publish')}
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
