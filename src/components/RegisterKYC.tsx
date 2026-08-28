import { useState } from 'react';
import { CheckCircle, Shield } from 'lucide-react';
import { addProcurementRecordAsync } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface RegisterKYCProps {
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
  userRole: string;
}

export function RegisterKYC({ setBlockchainRecords, blockchainRecords, userRole }: RegisterKYCProps) {
  const { t } = useTranslation();
  const [registered, setRegistered] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    registrationNumber: '',
    representative: '',
    email: '',
    taxId: '',
    beneficialOwnership: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.registrationNumber || !form.representative || !form.email) return;

    const { block, contract, success, onChain } = await addProcurementRecordAsync('supplier_registration', {
      company: form.companyName,
      registrationNumber: form.registrationNumber,
      timestamp: Date.now(),
    });

    if (success) {
      setBlockchainRecords([...blockchainRecords, {
        id: block.hash,
        type: 'supplier_registration',
        contractId: contract.id,
        transactionHash: contract.transactionHash,
        timestamp: new Date().toISOString(),
        verified: onChain,
        simulated: !onChain,
        onChain,
      }]);
    }

    setRegistered(true);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 11px', border: '1px solid #c3c2b7',
    borderRadius: 7, fontSize: '13.5px', fontFamily: 'inherit', background: '#fff',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#52514e', marginBottom: 5,
  };
  const formRowStyle: React.CSSProperties = { marginBottom: 13 };
  const hintStyle: React.CSSProperties = { fontSize: '11.5px', color: '#6e6c66', marginTop: 4 };

  if (registered) {
    return (
      <div className="space-y-6">
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('register.title')}</h1>
          <p style={{ margin: '0 0 10px 0', color: '#52514e' }}>{t('register.subtitle')}</p>
        </div>
        <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18, textAlign: 'center' }}>
          <CheckCircle style={{ width: 56, height: 56, color: '#0a6b0a', margin: '0 auto 12px' }} />
          <h2 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 20, color: '#0b0b0b' }}>{t('register.successTitle')}</h2>
          <p style={{ margin: '0 0 14px 0', color: '#52514e' }}>{t('register.successDesc')}</p>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: 999,
            color: '#0a6b0a', background: '#eaf8ea', border: '1px solid #c7ecc7',
          }}>
            <Shield style={{ width: 14, height: 14 }} />
            {t('register.verified')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('register.title')}</h1>
        <p style={{ margin: '0 0 10px 0', color: '#52514e' }}>{t('register.subtitle')}</p>
      </div>

      {/* Registration Form */}
      <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
        <form onSubmit={handleSubmit}>
          {/* 2-column grid for first 4 fields */}
          <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
            <div style={formRowStyle}>
              <label style={labelStyle}>{t('register.companyName')}</label>
              <input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder={t('register.companyPlaceholder')}
                style={inputStyle}
                required
              />
            </div>
            <div style={formRowStyle}>
              <label style={labelStyle}>{t('register.registrationNumber')}</label>
              <input
                value={form.registrationNumber}
                onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                placeholder={t('register.registrationPlaceholder')}
                style={inputStyle}
                required
              />
            </div>
            <div style={formRowStyle}>
              <label style={labelStyle}>{t('register.representative')}</label>
              <input
                value={form.representative}
                onChange={(e) => setForm({ ...form, representative: e.target.value })}
                placeholder={t('register.representativePlaceholder')}
                style={inputStyle}
                required
              />
            </div>
            <div style={formRowStyle}>
              <label style={labelStyle}>{t('register.email')}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t('register.emailPlaceholder')}
                style={inputStyle}
                required
              />
            </div>
          </div>

          {/* Tax ID — full width */}
          <div style={formRowStyle}>
            <label style={labelStyle}>{t('register.taxId')}</label>
            <input
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              placeholder={t('register.taxIdPlaceholder')}
              style={inputStyle}
            />
          </div>

          {/* Beneficial ownership disclosure */}
          <div style={formRowStyle}>
            <label style={labelStyle}>{t('register.beneficialOwnership')}</label>
            <textarea
              value={form.beneficialOwnership}
              onChange={(e) => setForm({ ...form, beneficialOwnership: e.target.value })}
              rows={3}
              placeholder={t('register.beneficialPlaceholder')}
              style={{ ...inputStyle, resize: 'vertical' as const }}
            />
            <div style={hintStyle}>{t('register.beneficialHint')}</div>
          </div>

          {/* Supporting documents */}
          <div style={formRowStyle}>
            <label style={labelStyle}>{t('register.documents')}</label>
            <input type="file" multiple style={inputStyle} />
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
            {t('register.submit')}
          </button>
        </form>
      </div>

      {/* Why e-KYC matters */}
      <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
        <h2 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('register.whyTitle')}</h2>
        <p style={{ margin: 0, color: '#52514e', fontSize: 15, lineHeight: 1.5 }}>{t('register.whyDesc')}</p>
      </div>
    </div>
  );
}
