import { useState } from 'react';
import { Scale, FileUp, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
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
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const [form, setForm] = useState({
    tenderId: '',
    grounds: '',
    evidence: null as File | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenderId || !form.grounds) return;

    const tender = tenders.find(td => td.id === form.tenderId);
    const newDispute = {
      id: `OBJ-${Date.now()}`,
      tenderId: form.tenderId,
      tenderTitle: tender?.title || form.tenderId,
      grounds: form.grounds,
      status: 'filed',
      filedAt: new Date().toISOString(),
      stage: 1,
    };

    const updated = [...disputes, newDispute];
    setDisputes(updated);

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

    setSubmittedId(newDispute.id);
    setSubmitted(true);
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
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                borderRadius: 8, padding: '9px 15px', fontSize: '13.5px', fontWeight: 700,
                cursor: 'pointer', border: '1px solid transparent', transition: '.15s',
                background: '#0f2942', color: '#fff',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#173d61'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = '#0f2942'; }}
            >
              {t('disputes.fileObjection')}
            </button>

            {/* Submission confirmation */}
            {submitted && (
              <div style={{
                border: '1px solid #bcd6f5', background: '#eef5fd', borderRadius: 8,
                padding: '11px 13px', fontSize: 13, color: '#164a86', marginTop: 14,
              }}>
                {t('disputes.submittedNotice')} <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{submittedId}</strong>
              </div>
            )}
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
    </div>
  );
}
