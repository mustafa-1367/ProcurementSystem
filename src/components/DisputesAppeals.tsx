import { useState } from 'react';
import { Scale, FileUp, CheckCircle, Clock, AlertTriangle, X, Loader2 } from 'lucide-react';
import { addProcurementRecordAsync } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface DisputesAppealsProps {
  disputes: any[];
  setDisputes: (disputes: any[]) => void;
  contracts: any[];
  tenders: any[];
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
}

export function DisputesAppeals({ disputes, setDisputes, contracts, tenders, setBlockchainRecords, blockchainRecords }: DisputesAppealsProps) {
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
    const disputeId = `OBJ-${Date.now()}`;

    // Call blockchain FIRST so MetaMask popup opens immediately
    const { block, contract, success, onChain } = await addProcurementRecordAsync('objection', {
      disputeId,
      objectionId: disputeId,
      tenderId: form.tenderId,
      title: form.grounds,
      timestamp: Date.now(),
    });

    const newDispute = {
      id: disputeId,
      tenderId: form.tenderId,
      tenderTitle: tender?.title || form.tenderId,
      title: `Objection: ${tender?.title || form.tenderId}`,
      description: form.grounds,
      relatedId: form.tenderId,
      grounds: form.grounds,
      type: 'oversight_complaint',
      status: 'voting',
      filedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      stage: 1,
      votes: { approve: 0, reject: 0, totalVoters: 0 },
      votingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      resolution: null,
      routingDecision: null,
      flaggedForReReview: false,
    };

    setDisputes([...disputes, newDispute]);

    if (success) {
      setBlockchainRecords([...blockchainRecords, {
        id: block.hash,
        type: 'objection_filed',
        disputeId,
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
      objectionId: disputeId,
      txHash: contract.transactionHash,
      onChain,
      tenderTitle: tender?.title || form.tenderId,
    });
    setForm({ tenderId: '', grounds: '', evidence: null });
  };

  const stageLabel = (stage: number) => {
    const stages = [
      t('disputes.stageFiled'),
      t('disputes.stageReview'),
      t('disputes.stageInvestigation'),
      t('disputes.stageDAOEscalation'),
      t('disputes.stageResolved'),
    ];
    return stages[stage - 1] || '';
  };

  const stageStyle = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-50 text-green-700 border-green-200';
      case 'filed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'under_review': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'escalated': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const stageIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="w-3.5 h-3.5" />;
      case 'filed': return <Clock className="w-3.5 h-3.5" />;
      case 'escalated': return <AlertTriangle className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('disputes.title')}</h1>
        <p style={{ margin: '0 0 10px 0', color: '#52514e' }}>{t('disputes.subtitle')}</p>
      </div>

      {/* Two-column layout: Form + Info card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Objection Form — matches Sharakat Chain .card + .form-row + .btn-primary */}
        <div style={{
          background: '#fcfcfb',
          border: '1px solid rgba(11,11,11,0.10)',
          borderRadius: 10,
          padding: 18,
        }}>
          <form onSubmit={handleSubmit}>
            {/* Related tender */}
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

            {/* Grounds for objection */}
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

            {/* Supporting evidence */}
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

        {/* Info Card — Objection Window (Sharakat Chain .card style) */}
        <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
          <h2 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>
            {t('disputes.objectionWindowTitle')}
          </h2>
          <p style={{ margin: '0 0 10px 0', color: '#52514e', fontSize: 15, lineHeight: 1.5 }}>
            {t('disputes.objectionWindowDesc')}
          </p>
        </div>
      </div>

      {/* Filed Objections List */}
      {disputes.length > 0 && (
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
              </tr>
            </thead>
            <tbody>
              {disputes.map((dispute: any, idx: number) => (
                <tr key={dispute.id} style={{ background: 'transparent' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8f8f6'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <td style={{ padding: 10, borderBottom: idx === disputes.length - 1 ? 'none' : '1px solid #e1e0d9', fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}>{dispute.id}</td>
                  <td style={{ padding: 10, borderBottom: idx === disputes.length - 1 ? 'none' : '1px solid #e1e0d9' }}>
                    <strong>{dispute.tenderTitle || dispute.contractTitle || ''}</strong>
                    <br /><span style={{ fontSize: '12.5px', color: '#6e6c66' }}>{dispute.tenderId || dispute.contractId || ''}</span>
                  </td>
                  <td style={{ padding: 10, borderBottom: idx === disputes.length - 1 ? 'none' : '1px solid #e1e0d9', color: '#52514e' }}>{dispute.grounds || dispute.reason || ''}</td>
                  <td style={{ padding: 10, borderBottom: idx === disputes.length - 1 ? 'none' : '1px solid #e1e0d9', color: '#6e6c66', fontSize: '12.5px' }}>{new Date(dispute.filedAt || dispute.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: 10, borderBottom: idx === disputes.length - 1 ? 'none' : '1px solid #e1e0d9' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 999, border: '1px solid',
                      ...(dispute.status === 'filed' ? { color: '#1c5cab', background: '#eef5fd', borderColor: '#bcd6f5' } :
                          dispute.status === 'resolved' ? { color: '#0a6b0a', background: '#eaf8ea', borderColor: '#c7ecc7' } :
                          dispute.status === 'escalated' ? { color: '#8a5a12', background: '#fdf3df', borderColor: '#f0dcae' } :
                          { color: '#52514e', background: '#f0efec', borderColor: '#e1e0d9' }),
                    }}>
                      {dispute.status === 'filed' ? t('disputes.statusFiled') :
                       dispute.status === 'under_review' ? t('disputes.statusReview') :
                       dispute.status === 'escalated' ? t('disputes.statusEscalated') :
                       dispute.status === 'resolved' ? t('disputes.statusResolved') :
                       dispute.status}
                    </span>
                    {' '}
                    {blockchainRecords.some(r => r.disputeId === dispute.id && r.onChain) && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>● On-Chain</span>
                    )}
                  </td>
                </tr>
              ))}
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
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t('disputes.txHash')}</span>
                <span style={{ fontSize: 11, color: '#0f2942', fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{submitSuccess.txHash}</span>
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
