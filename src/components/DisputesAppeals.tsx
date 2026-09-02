import { useState } from 'react';
import { Scale, FileUp, CheckCircle, Clock, AlertTriangle, X, Loader2, ArrowUpRight, ThumbsUp, ThumbsDown } from 'lucide-react';
import { addProcurementRecordAsync } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';
import { TxHashLink } from './TxHashLink';

interface DisputesAppealsProps {
  disputes: any[];
  setDisputes: (disputes: any[]) => void;
  contracts: any[];
  tenders: any[];
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
  userRole: string;
}

export function DisputesAppeals({ disputes, setDisputes, contracts, tenders, setBlockchainRecords, blockchainRecords, userRole }: DisputesAppealsProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<{ objectionId: string; txHash: string; onChain: boolean; tenderTitle: string } | null>(null);
  const [form, setForm] = useState({
    tenderId: '',
    grounds: '',
    evidence: null as File | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenderId || !form.grounds || submitting) return;

    setSubmitting(true);

    const tender = tenders.find(td => td.id === form.tenderId);
    const newDispute = {
      id: `OBJ-${Date.now()}`,
      tenderId: form.tenderId,
      tenderTitle: tender?.title || form.tenderId,
      title: `Objection: ${tender?.title || form.tenderId}`,
      description: form.grounds,
      relatedId: form.tenderId,
      grounds: form.grounds,
      type: 'objection',
      status: 'filed',
      filedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      stage: 1,
      resolution: null,
      routingDecision: null,
      flaggedForReReview: false,
    };

    setDisputes([...disputes, newDispute]);

    const { block, contract, success, onChain } = await addProcurementRecordAsync('objection', {
      disputeId: newDispute.id,
      objectionId: newDispute.id,
      tenderId: form.tenderId,
      title: newDispute.grounds,
      timestamp: Date.now(),
    });

    if (success) {
      setBlockchainRecords([...blockchainRecords, {
        id: block.hash,
        type: 'objection_filed',
        disputeId: newDispute.id,
        contractId: contract.id,
        transactionHash: contract.transactionHash,
        timestamp: new Date().toISOString(),
        verified: onChain,
        simulated: !onChain,
        onChain,
      }]);
    }

    setSubmitting(false);
    setSubmitSuccess({
      objectionId: newDispute.id,
      txHash: contract.transactionHash,
      onChain,
      tenderTitle: tender?.title || form.tenderId,
    });
    setForm({ tenderId: '', grounds: '', evidence: null });
  };

  // Government: accept objection → mark as accepted, flag for re-review
  const handleAcceptObjection = async (dispute: any) => {
    const updated = disputes.map(d =>
      d.id === dispute.id ? { ...d, status: 'accepted', reviewDecision: 'accepted', flaggedForReReview: true, routingDecision: 'evaluation_committee', reviewedAt: new Date().toISOString() } : d
    );
    setDisputes(updated);

    const { block, contract, onChain } = await addProcurementRecordAsync('objection_review', {
      disputeId: dispute.id,
      decision: 'accepted',
      timestamp: Date.now(),
    });

    setBlockchainRecords([...blockchainRecords, {
      id: block.hash,
      type: 'objection_accepted',
      disputeId: dispute.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
    }]);
  };

  // Government: reject objection → mark as rejected
  const handleRejectObjection = async (dispute: any) => {
    const updated = disputes.map(d =>
      d.id === dispute.id ? { ...d, status: 'rejected', reviewDecision: 'rejected', reviewedAt: new Date().toISOString() } : d
    );
    setDisputes(updated);

    const { block, contract, onChain } = await addProcurementRecordAsync('objection_review', {
      disputeId: dispute.id,
      decision: 'rejected',
      timestamp: Date.now(),
    });

    setBlockchainRecords([...blockchainRecords, {
      id: block.hash,
      type: 'objection_rejected',
      disputeId: dispute.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
    }]);
  };

  // Supplier: escalate rejected objection to DAO
  const handleEscalateToDAO = async (dispute: any) => {
    const escalated = {
      id: `DAO-${Date.now()}`,
      title: `Escalated: ${dispute.title}`,
      description: dispute.grounds || dispute.description,
      relatedId: dispute.tenderId || dispute.relatedId || '',
      tenderId: dispute.tenderId,
      tenderTitle: dispute.tenderTitle,
      type: 'escalated_objection',
      status: 'voting',
      sourceDisputeId: dispute.id,
      createdAt: new Date().toISOString(),
      votes: { approve: 0, reject: 0, totalVoters: 0 },
      votingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      resolution: null,
      routingDecision: null,
      flaggedForReReview: false,
    };

    const { block, contract, onChain } = await addProcurementRecordAsync('dao_escalation', {
      disputeId: escalated.id,
      sourceDisputeId: dispute.id,
      title: escalated.title,
      escalated: true,
    });

    setBlockchainRecords([...blockchainRecords, {
      id: block.hash,
      type: 'objection_escalated',
      disputeId: escalated.id,
      sourceDisputeId: dispute.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
    }]);

    // Add escalated dispute and mark original as escalated
    const updatedDisputes = disputes.map(d =>
      d.id === dispute.id ? { ...d, status: 'escalated', escalatedToDAO: true, escalatedDisputeId: escalated.id } : d
    );
    setDisputes([...updatedDisputes, escalated]);
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'filed': return t('disputes.statusFiled');
      case 'accepted': return t('disputes.statusAccepted');
      case 'rejected': return t('disputes.statusRejected');
      case 'escalated': return t('disputes.statusEscalated');
      case 'resolved': return t('disputes.statusResolved');
      default: return status;
    }
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case 'filed': return { color: '#1c5cab', background: '#eef5fd', borderColor: '#bcd6f5' };
      case 'accepted': return { color: '#0a6b0a', background: '#eaf8ea', borderColor: '#c7ecc7' };
      case 'rejected': return { color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca' };
      case 'escalated': return { color: '#8a5a12', background: '#fdf3df', borderColor: '#f0dcae' };
      case 'resolved': return { color: '#0a6b0a', background: '#eaf8ea', borderColor: '#c7ecc7' };
      default: return { color: '#52514e', background: '#f0efec', borderColor: '#e1e0d9' };
    }
  };

  // Filter objections only (not escalated DAO items)
  const objections = disputes.filter(d => d.type === 'objection');
  const filedObjections = objections.filter(d => d.status === 'filed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('disputes.title')}</h1>
        <p style={{ margin: '0 0 10px 0', color: '#52514e' }}>{t('disputes.subtitle')}</p>
      </div>

      {/* Supplier: Objection Form */}
      {(userRole === 'supplier') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div style={{
            background: '#fcfcfb',
            border: '1px solid rgba(11,11,11,0.10)',
            borderRadius: 10,
            padding: 18,
          }}>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 13 }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#52514e', marginBottom: 5 }}>
                  {t('disputes.relatedTender')}
                </label>
                {tenders.length > 0 ? (
                  <select
                    value={form.tenderId}
                    onChange={(e) => setForm({ ...form, tenderId: e.target.value })}
                    style={{ width: '100%', padding: '9px 11px', border: '1px solid #c3c2b7', borderRadius: 7, fontSize: '13.5px', fontFamily: 'inherit', background: '#fff' }}
                    required
                  >
                    <option value="">{t('disputes.selectTender')}</option>
                    {tenders.map((td: any) => (
                      <option key={td.id} value={td.id}>{td.id} — {td.title}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.tenderId}
                    onChange={(e) => setForm({ ...form, tenderId: e.target.value })}
                    placeholder={t('disputes.tenderPlaceholder')}
                    style={{ width: '100%', padding: '9px 11px', border: '1px solid #c3c2b7', borderRadius: 7, fontSize: '13.5px', fontFamily: 'inherit', background: '#fff' }}
                    required
                  />
                )}
              </div>

              <div style={{ marginBottom: 13 }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#52514e', marginBottom: 5 }}>
                  {t('disputes.groundsLabel')}
                </label>
                <textarea
                  value={form.grounds}
                  onChange={(e) => setForm({ ...form, grounds: e.target.value })}
                  rows={4}
                  placeholder={t('disputes.groundsPlaceholder')}
                  style={{ width: '100%', padding: '9px 11px', border: '1px solid #c3c2b7', borderRadius: 7, fontSize: '13.5px', fontFamily: 'inherit', background: '#fff', resize: 'vertical' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 13 }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#52514e', marginBottom: 5 }}>
                  {t('disputes.evidenceLabel')}
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setForm({ ...form, evidence: e.target.files?.[0] || null })}
                  style={{ width: '100%', padding: '9px 11px', border: '1px solid #c3c2b7', borderRadius: 7, fontSize: '13.5px', fontFamily: 'inherit', background: '#fff' }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  borderRadius: 8, padding: '9px 15px', fontSize: '13.5px', fontWeight: 700,
                  cursor: submitting ? 'wait' : 'pointer', border: '1px solid transparent', transition: '.15s',
                  background: '#0f2942', color: '#fff', opacity: submitting ? 0.7 : 1,
                }}
                onMouseEnter={(e) => { if (!submitting) (e.target as HTMLElement).style.background = '#173d61'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#0f2942'; }}
              >
                {submitting && <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />}
                {submitting ? t('disputes.submitting') : t('disputes.fileObjection')}
              </button>
            </form>
          </div>

          <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
            <h2 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>
              {t('disputes.objectionWindowTitle')}
            </h2>
            <p style={{ margin: '0 0 10px 0', color: '#52514e', fontSize: 15, lineHeight: 1.5 }}>
              {t('disputes.objectionWindowDesc')}
            </p>
          </div>
        </div>
      )}

      {/* Government: Review Panel for filed objections */}
      {userRole === 'government' && filedObjections.length > 0 && (
        <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
          <h2 style={{ margin: '0 0 12px 0', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>
            {t('disputes.governmentReviewTitle')}
          </h2>
          <div className="space-y-3">
            {filedObjections.map((dispute: any) => (
              <div key={dispute.id} style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f2942', marginBottom: 4 }}>{dispute.title}</div>
                  <div style={{ fontSize: 13, color: '#52514e', marginBottom: 4 }}>{dispute.grounds || dispute.description}</div>
                  <div style={{ fontSize: 12, color: '#6e6c66' }}>
                    {dispute.tenderTitle} • {new Date(dispute.filedAt || dispute.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => handleAcceptObjection(dispute)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '8px 14px', borderRadius: 8, border: '1px solid #059669',
                      background: '#ecfdf5', color: '#059669', fontSize: 13, fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <ThumbsUp style={{ width: 14, height: 14 }} />
                    {t('disputes.acceptObjection')}
                  </button>
                  <button
                    onClick={() => handleRejectObjection(dispute)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '8px 14px', borderRadius: 8, border: '1px solid #dc2626',
                      background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <ThumbsDown style={{ width: 14, height: 14 }} />
                    {t('disputes.rejectObjection')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filed Objections List */}
      {objections.length > 0 && (
        <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('disputes.listTitle')}</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>{t('disputes.colId')}</th>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>{t('disputes.colTender')}</th>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>{t('disputes.colGrounds')}</th>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>{t('disputes.colDate')}</th>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>{t('disputes.colStatus')}</th>
                {userRole === 'supplier' && (
                  <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>{t('disputes.colActions')}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {objections.map((dispute: any, idx: number) => {
                const sStyle = statusStyle(dispute.status);
                return (
                  <tr key={dispute.id} style={{ background: 'transparent' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8f8f6'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <td style={{ padding: 10, borderBottom: idx === objections.length - 1 ? 'none' : '1px solid #e1e0d9', fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}>{dispute.id}</td>
                    <td style={{ padding: 10, borderBottom: idx === objections.length - 1 ? 'none' : '1px solid #e1e0d9' }}>
                      <strong>{dispute.tenderTitle || dispute.contractTitle || ''}</strong>
                      <br /><span style={{ fontSize: '12.5px', color: '#6e6c66' }}>{dispute.tenderId || dispute.contractId || ''}</span>
                    </td>
                    <td style={{ padding: 10, borderBottom: idx === objections.length - 1 ? 'none' : '1px solid #e1e0d9', color: '#52514e' }}>{dispute.grounds || dispute.reason || ''}</td>
                    <td style={{ padding: 10, borderBottom: idx === objections.length - 1 ? 'none' : '1px solid #e1e0d9', color: '#6e6c66', fontSize: '12.5px' }}>{new Date(dispute.filedAt || dispute.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: 10, borderBottom: idx === objections.length - 1 ? 'none' : '1px solid #e1e0d9' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 999, border: '1px solid',
                        color: sStyle.color, background: sStyle.background, borderColor: sStyle.borderColor,
                      }}>
                        {statusLabel(dispute.status)}
                      </span>
                      {' '}
                      {blockchainRecords.some(r => r.disputeId === dispute.id && r.onChain) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>● On-Chain</span>
                      )}
                    </td>
                    {userRole === 'supplier' && (
                      <td style={{ padding: 10, borderBottom: idx === objections.length - 1 ? 'none' : '1px solid #e1e0d9' }}>
                        {dispute.status === 'rejected' && !dispute.escalatedToDAO && (
                          <button
                            onClick={() => handleEscalateToDAO(dispute)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 12px', borderRadius: 8, border: '1px solid #c99a3c',
                              background: '#fef9e7', color: '#78350f', fontSize: 12, fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <ArrowUpRight style={{ width: 13, height: 13 }} />
                            {t('disputes.escalateToDAO')}
                          </button>
                        )}
                        {dispute.escalatedToDAO && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#8a5a12' }}>
                            {t('disputes.escalatedToDAO')}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Success Confirmation Modal ── */}
      {submitSuccess && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.5)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.25)', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle style={{ width: 32, height: 32, color: '#059669' }} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#0f2942' }}>
              {t('disputes.objectionSubmitted')}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              {t('disputes.objectionSubmittedDesc')}
            </p>

            <div style={{ textAlign: 'left', background: '#f9fafb', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t('disputes.objectionId')}</span>
                <span style={{ fontSize: 12, color: '#0f2942', fontWeight: 700, fontFamily: 'monospace' }}>{submitSuccess.objectionId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t('disputes.relatedTender')}</span>
                <span style={{ fontSize: 12, color: '#0f2942', fontWeight: 700 }}>{submitSuccess.tenderTitle}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t('disputes.blockchainStatus')}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: submitSuccess.onChain ? '#059669' : '#d97706' }}>
                  {submitSuccess.onChain ? t('disputes.onChainConfirmed') : t('disputes.simulatedRecord')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t('disputes.txHash')}</span>
                <TxHashLink hash={submitSuccess.txHash} truncate={18} />
              </div>
            </div>

            <div style={{ textAlign: 'left', background: '#eff6ff', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>{t('disputes.nextSteps')}</h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#1e3a5f', lineHeight: 1.8 }}>
                <li>{t('disputes.nextStep1')}</li>
                <li>{t('disputes.nextStep2')}</li>
                <li>{t('disputes.nextStep3')}</li>
              </ul>
            </div>

            <button
              onClick={() => setSubmitSuccess(null)}
              style={{
                width: '100%', padding: '12px 24px', borderRadius: 10, border: 'none',
                background: '#0f2942', color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', transition: 'background .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1e4976'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#0f2942'; }}
            >
              {t('disputes.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
