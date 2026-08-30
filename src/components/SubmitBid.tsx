import { useState } from 'react';
import { Send, FileText, Banknote, Calendar, Building, Eye, Upload, ShieldCheck, Lock, CheckCircle, Shield } from 'lucide-react';
import { addProcurementRecordAsync } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface SubmitBidProps {
  tenders: any[];
  bids: any[];
  setBids: (bids: any[]) => void;
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
  registeredSuppliers: any[];
}

export function SubmitBid({ tenders, bids, setBids, setBlockchainRecords, blockchainRecords, registeredSuppliers }: SubmitBidProps) {
  const { t } = useTranslation();
  const parseBudget = (v: any) => Number(String(v).replace(/,/g, ''));
  const [selectedTender, setSelectedTender] = useState<any>(null);
  const [viewTender, setViewTender] = useState<any>(null);
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidForm, setBidForm] = useState({
    vendorName: '',
    vendorEmail: '',
    amount: '',
    timeline: '',
  });

  const [eligibilityError, setEligibilityError] = useState(false);
  const [bidSuccess, setBidSuccess] = useState<{ bidId: string; tenderTitle: string; vendorName: string; amount: string; onChain: boolean } | null>(null);

  const publishedTenders = tenders.filter((td) => td.status === 'published');
  const myBids = bids;
  const isRegisteredByName = (name: string) =>
    registeredSuppliers.some((s) => s.companyName?.toLowerCase().trim() === name?.toLowerCase().trim());
  const isEligible = registeredSuppliers.length > 0;

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTender) return;

    const registeredSupplier = registeredSuppliers.find(
      (s) => s.companyName?.toLowerCase().trim() === bidForm.vendorName?.toLowerCase().trim()
    );
    if (!registeredSupplier) {
      setEligibilityError(true);
      return;
    }
    setEligibilityError(false);

    // Prevent duplicate bids — one bid per supplier per tender
    const alreadyBid = bids.some(
      (b) => b.tenderId === selectedTender.id && b.vendorName?.toLowerCase().trim() === bidForm.vendorName?.toLowerCase().trim()
    );
    if (alreadyBid) {
      alert(t('tendering.duplicateBid'));
      return;
    }

    const newBid = {
      id: `BID-${Date.now()}`,
      tenderId: selectedTender.id,
      tenderTitle: selectedTender.title,
      ...bidForm,
      vendorEmail: registeredSupplier.email,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      evaluated: false,
      score: null,
    };

    const updatedBids = [...bids, newBid];
    setBids(updatedBids);

    const { block, contract, success, onChain } = await addProcurementRecordAsync('bid_submission', {
      bidId: newBid.id,
      tenderId: selectedTender.id,
      vendor: bidForm.vendorName,
      amount: bidForm.amount,
      timestamp: Date.now(),
    });

    if (success) {
      setBlockchainRecords([...blockchainRecords, {
        id: block.hash,
        type: 'bid_submitted',
        bidId: newBid.id,
        contractId: contract.id,
        transactionHash: contract.transactionHash,
        timestamp: new Date().toISOString(),
        verified: onChain,
        simulated: !onChain,
        onChain,
      }]);
    }

    setBidSuccess({
      bidId: newBid.id,
      tenderTitle: selectedTender.title,
      vendorName: bidForm.vendorName,
      amount: bidForm.amount,
      onChain: !!onChain,
    });
    setBidForm({ vendorName: '', vendorEmail: '', amount: '', timeline: '' });
    setShowBidForm(false);
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      submitted: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
      awarded: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
      rejected: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
    };
    const s = styles[status] || { bg: '#f4f4f5', color: '#52525b', border: '#e4e4e7' };
    return {
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
      padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: 'capitalize' as const,
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0b0b0b', letterSpacing: '-0.01em' }}>{t('submitBid.title')}</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6e6c66' }}>{t('submitBid.subtitle')}</p>
      </div>

      {/* My Submitted Bids */}
      {myBids.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(11,11,11,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(11,11,11,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText style={{ width: 16, height: 16, color: '#6e6c66' }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0b0b0b' }}>{t('submitBid.myBids')}</h3>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#f0f0ee', color: '#6e6c66' }}>{myBids.length}</span>
          </div>
          <div>
            {myBids.map((bid: any, idx: number) => (
              <div key={bid.id} style={{
                padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: idx < myBids.length - 1 ? '1px solid rgba(11,11,11,0.05)' : 'none',
                transition: 'background 0.15s', cursor: 'default',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fafaf9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0b0b0b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bid.tenderTitle}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 12, color: '#6e6c66', fontFamily: 'ui-monospace, monospace' }}>{bid.id}</span>
                    <span style={{ fontSize: 11, color: '#9e9d99' }}>·</span>
                    <span style={{ fontSize: 12, color: '#6e6c66', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Calendar style={{ width: 11, height: 11 }} />
                      {new Date(bid.submittedAt).toLocaleDateString()}
                    </span>
                    {bid.amount && (
                      <>
                        <span style={{ fontSize: 11, color: '#9e9d99' }}>·</span>
                        <span style={{ fontSize: 12, color: '#0b0b0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Banknote style={{ width: 11, height: 11, color: '#6e6c66' }} />
                          {Number(bid.amount).toLocaleString()} AFN
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                  <span style={statusBadge(bid.status)}>{bid.status}</span>
                  {blockchainRecords.some(r => r.bidId === bid.id && r.onChain) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                      <Shield style={{ width: 10, height: 10 }} /> On-Chain
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Eligibility Warning */}
      {eligibilityError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldCheck style={{ width: 24, height: 24, color: '#dc2626', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#991b1b' }}>Registration Required</div>
            <div style={{ fontSize: 13, color: '#7f1d1d' }}>You must complete KYC registration before submitting bids. Go to the <strong>Register (e-KYC)</strong> tab to register your company first.</div>
          </div>
        </div>
      )}

      {/* Available Tenders */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(11,11,11,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(11,11,11,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Send style={{ width: 16, height: 16, color: '#6e6c66' }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0b0b0b' }}>{t('submitBid.availableTenders')}</h3>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8' }}>{publishedTenders.length}</span>
        </div>
        {publishedTenders.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9e9d99', fontSize: 14 }}>{t('submitBid.noTenders')}</div>
        ) : (
          <div>
            {publishedTenders.map((tender: any, idx: number) => (
              <div key={tender.id} style={{
                padding: '16px 20px',
                borderBottom: idx < publishedTenders.length - 1 ? '1px solid rgba(11,11,11,0.05)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0b0b0b', marginBottom: 4 }}>{tender.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: '#6e6c66', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Building style={{ width: 11, height: 11 }} />
                        {tender.department}
                      </span>
                      <span style={{ fontSize: 11, color: '#d1d0cc' }}>·</span>
                      <span style={{ fontSize: 12, color: '#0b0b0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Banknote style={{ width: 11, height: 11, color: '#6e6c66' }} />
                        {t('submitBid.budget')}: {isNaN(parseBudget(tender.budget)) ? '—' : parseBudget(tender.budget).toLocaleString()} AFN
                      </span>
                      <span style={{ fontSize: 11, color: '#d1d0cc' }}>·</span>
                      <span style={{ fontSize: 12, color: '#6e6c66', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Calendar style={{ width: 11, height: 11 }} />
                        {new Date(tender.deadline).toLocaleDateString()}
                      </span>
                    </div>
                    {tender.description && (
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: '#52514e', lineHeight: 1.5 }}>{tender.description}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => setViewTender(viewTender?.id === tender.id ? null : tender)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600,
                        color: '#1d4ed8', background: 'none', border: '1px solid #bfdbfe', borderRadius: 8,
                        padding: '7px 14px', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <Eye style={{ width: 14, height: 14 }} /> {t('submitBid.view')}
                    </button>
                    <button
                      onClick={() => {
                        if (!isEligible) { setEligibilityError(true); return; }
                        setEligibilityError(false);
                        setSelectedTender(tender);
                        setShowBidForm(true);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700,
                        color: '#fff', background: '#1d4ed8', border: 'none', borderRadius: 8,
                        padding: '7px 16px', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <Send style={{ width: 13, height: 13 }} /> {t('submitBid.submitBtn')}
                    </button>
                  </div>
                </div>
                {viewTender?.id === tender.id && (
                  <div style={{ background: '#fafaf9', border: '1px solid rgba(11,11,11,0.08)', borderRadius: 10, padding: 16, marginTop: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.department')}</div>
                        <div style={{ fontSize: '13.5px', color: '#0b0b0b' }}>{tender.department}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.budget')}</div>
                        <div style={{ fontSize: '13.5px', color: '#0b0b0b' }}>{isNaN(parseBudget(tender.budget)) ? '—' : parseBudget(tender.budget).toLocaleString()} AFN</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.category')}</div>
                        <div style={{ fontSize: '13.5px', color: '#0b0b0b' }}>{tender.category}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.submissionDeadline')}</div>
                        <div style={{ fontSize: '13.5px', color: '#0b0b0b' }}>{new Date(tender.deadline).toLocaleDateString()}</div>
                      </div>
                    </div>
                    {tender.requirements && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.requirements')}</div>
                        <div style={{ fontSize: '13.5px', color: '#52514e' }}>{tender.requirements}</div>
                      </div>
                    )}
                    {tender.method && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('preTender.procurementMethod')}</div>
                        <div style={{ fontSize: '13.5px', color: '#52514e' }}>{tender.method}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bid Submission Form Modal */}
      {showBidForm && selectedTender && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
          <div style={{ background: '#fcfcfb', borderRadius: 14, maxWidth: 640, width: '100%', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column' }}>

            {/* Header with tender context */}
            <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)', padding: '20px 24px', position: 'relative' }}>
              <button
                type="button"
                onClick={() => { setShowBidForm(false); setSelectedTender(null); setEligibilityError(false); }}
                style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}
              >
                &times;
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send style={{ width: 20, height: 20, color: '#fff' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontWeight: 700, fontSize: 18, color: '#fff' }}>{t('submitBid.formTitle')}</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{selectedTender.title}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: t('preTender.budget'), value: `${isNaN(parseBudget(selectedTender.budget)) ? '—' : parseBudget(selectedTender.budget).toLocaleString()} AFN` },
                  { label: t('preTender.category'), value: selectedTender.category },
                  { label: t('preTender.submissionDeadline'), value: new Date(selectedTender.deadline).toLocaleDateString() },
                ].map((item, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    <span>{item.label}: </span>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sealed bid notice */}
            <div style={{ padding: '10px 24px', background: '#eef5fd', borderBottom: '1px solid #bcd6f5', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock style={{ width: 14, height: 14, color: '#1c5cab' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1c5cab' }}>{t('tendering.sealedNotice')}</span>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitBid} style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
              {eligibilityError && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16,
                }}>
                  <ShieldCheck style={{ width: 18, height: 18, color: '#b91c1c', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#b91c1c', marginBottom: 2 }}>{t('tendering.kycRequired')}</div>
                    <div style={{ fontSize: 12.5, color: '#991b1b', lineHeight: 1.5 }}>{t('tendering.kycRequiredDesc')}</div>
                  </div>
                </div>
              )}

              {/* Bidder & Financial */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>{t('tendering.bidderInfo')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#0b0b0b', marginBottom: 6 }}>
                      <Building style={{ width: 14, height: 14, color: '#6e6c66' }} />
                      {t('submitBid.vendorName')} *
                    </label>
                    <input
                      required
                      value={bidForm.vendorName}
                      onChange={(e) => { setBidForm({ ...bidForm, vendorName: e.target.value }); setEligibilityError(false); }}
                      style={{
                        width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8,
                        border: eligibilityError ? '1.5px solid #f87171' : '1px solid #e1e0d9',
                        outline: 'none', background: '#fff', color: '#0b0b0b',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#0b0b0b', marginBottom: 6 }}>
                      <Banknote style={{ width: 14, height: 14, color: '#6e6c66' }} />
                      {t('submitBid.amount')} (AFN) *
                    </label>
                    <input
                      type="number"
                      required
                      value={bidForm.amount}
                      onChange={(e) => setBidForm({ ...bidForm, amount: e.target.value })}
                      style={{
                        width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8,
                        border: Number(bidForm.amount) > parseBudget(selectedTender.budget) && !isNaN(parseBudget(selectedTender.budget)) ? '1.5px solid #f59e0b' : '1px solid #e1e0d9',
                        outline: 'none', background: '#fff', color: '#0b0b0b',
                      }}
                    />
                    {!isNaN(parseBudget(selectedTender.budget)) && (
                      <div style={{ fontSize: 11.5, color: '#6e6c66', marginTop: 4 }}>
                        {t('tendering.estimatedBudget')}: <strong>{parseBudget(selectedTender.budget).toLocaleString()} AFN</strong>
                      </div>
                    )}
                    {Number(bidForm.amount) > parseBudget(selectedTender.budget) && !isNaN(parseBudget(selectedTender.budget)) && (
                      <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 4, fontWeight: 600 }}>
                        {t('tendering.exceedsBudget')}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#0b0b0b', marginBottom: 6 }}>
                    <Calendar style={{ width: 14, height: 14, color: '#6e6c66' }} />
                    {t('submitBid.timeline')}
                  </label>
                  <input
                    value={bidForm.timeline}
                    onChange={(e) => setBidForm({ ...bidForm, timeline: e.target.value })}
                    placeholder={t('submitBid.timelinePlaceholder')}
                    style={{
                      width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 8,
                      border: '1px solid #e1e0d9', outline: 'none', background: '#fff', color: '#0b0b0b',
                    }}
                  />
                </div>
              </div>

              {/* Documents */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>{t('tendering.technicalSection')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#0b0b0b', marginBottom: 6 }}>
                      <FileText style={{ width: 14, height: 14, color: '#6e6c66' }} />
                      {t('submitBid.technicalSpecDocs')}
                    </label>
                    <input
                      type="file"
                      multiple
                      style={{
                        width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
                        border: '1px solid #e1e0d9', background: '#fff', color: '#0b0b0b',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#0b0b0b', marginBottom: 6 }}>
                      <ShieldCheck style={{ width: 14, height: 14, color: '#6e6c66' }} />
                      {t('submitBid.bidSecurity')}
                    </label>
                    <input
                      type="file"
                      style={{
                        width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
                        border: '1px solid #e1e0d9', background: '#fff', color: '#0b0b0b',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#0b0b0b', marginBottom: 6 }}>
                      <Upload style={{ width: 14, height: 14, color: '#6e6c66' }} />
                      {t('submitBid.documents')}
                    </label>
                    <input
                      type="file"
                      multiple
                      style={{
                        width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
                        border: '1px solid #e1e0d9', background: '#fff', color: '#0b0b0b',
                      }}
                    />
                    <p style={{ fontSize: 11.5, color: '#9e9d98', marginTop: 4 }}>{t('submitBid.documentsHint')}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #e8e7e4' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)', color: '#fff',
                    padding: '11px 20px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(30,58,95,0.25)',
                  }}
                >
                  <Lock style={{ width: 16, height: 16 }} />
                  {t('submitBid.submitBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowBidForm(false); setSelectedTender(null); setEligibilityError(false); }}
                  style={{
                    padding: '11px 20px', borderRadius: 10, border: '1px solid #e1e0d9',
                    background: '#fff', color: '#52514e', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('submitBid.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bidSuccess && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 480, width: '100%', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ background: '#ecfdf5', padding: '32px 24px', textAlign: 'center', borderBottom: '1px solid #a7f3d0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <CheckCircle style={{ width: 32, height: 32, color: '#065f46' }} />
              </div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 700, color: '#065f46' }}>Bid Submitted Successfully</h3>
              <p style={{ margin: 0, fontSize: 14, color: '#047857' }}>Your bid has been recorded and sealed.</p>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Tender</span>
                  <span style={{ fontWeight: 600, color: '#0f2942' }}>{bidSuccess.tenderTitle}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Bidder</span>
                  <span style={{ fontWeight: 600, color: '#0f2942' }}>{bidSuccess.vendorName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Bid Amount</span>
                  <span style={{ fontWeight: 600, color: '#0f2942' }}>{Number(bidSuccess.amount).toLocaleString()} AFN</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Bid ID</span>
                  <span style={{ fontWeight: 600, color: '#0f2942', fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{bidSuccess.bidId}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Lock style={{ width: 12, height: 12 }} /> Sealed & Encrypted
                </span>
                {bidSuccess.onChain && (
                  <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    ● Recorded On-Chain
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setBidSuccess(null);
                  setSelectedTender(null);
                }}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                  background: '#0f2942', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
