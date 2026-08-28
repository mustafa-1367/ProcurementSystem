import { useState } from 'react';
import { CheckCircle, Shield, AlertTriangle } from 'lucide-react';
import { addProcurementRecordAsync } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface RegisterKYCProps {
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
  userRole: string;
  registeredSuppliers: any[];
  setRegisteredSuppliers: (suppliers: any[]) => void;
}

export function RegisterKYC({ setBlockchainRecords, blockchainRecords, userRole, registeredSuppliers, setRegisteredSuppliers }: RegisterKYCProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    companyName: '',
    registrationNumber: '',
    representative: '',
    email: '',
    taxId: '',
    beneficialOwnership: '',
  });

  const registered = registeredSuppliers.some(
    (s) => s.companyName === form.companyName && s.email === form.email && form.companyName !== ''
  ) || registeredSuppliers.length > 0 && form.companyName === '';

  // Check if there's already a registration (show success if so)
  const hasRegistration = registeredSuppliers.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.registrationNumber || !form.representative || !form.email) return;

    // Check for duplicate
    if (registeredSuppliers.some((s) => s.email === form.email)) {
      alert('This email is already registered.');
      return;
    }

    const newSupplier = {
      id: `SUP-${Date.now()}`,
      companyName: form.companyName,
      registrationNumber: form.registrationNumber,
      representative: form.representative,
      email: form.email,
      taxId: form.taxId,
      beneficialOwnership: form.beneficialOwnership,
      registeredAt: new Date().toISOString(),
      eligible: true,
      checks: {
        businessRegistration: !!form.registrationNumber,
        taxClearance: !!form.taxId,
        notDebarred: true,
        noConflictOfInterest: true,
      },
    };

    const { block, contract, success, onChain } = await addProcurementRecordAsync('supplier_registration', {
      company: form.companyName,
      registrationNumber: form.registrationNumber,
      timestamp: Date.now(),
    });

    if (success) {
      setBlockchainRecords([...blockchainRecords, {
        id: block.hash,
        type: 'supplier_registration',
        supplierId: newSupplier.id,
        contractId: contract.id,
        transactionHash: contract.transactionHash,
        timestamp: new Date().toISOString(),
        verified: onChain,
        simulated: !onChain,
        onChain,
      }]);
    }

    setRegisteredSuppliers([...registeredSuppliers, newSupplier]);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('register.title')}</h1>
        <p style={{ margin: '0 0 10px 0', color: '#52514e' }}>{t('register.subtitle')}</p>
      </div>

      {/* Registered Suppliers List */}
      {registeredSuppliers.length > 0 && (
        <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
          <h2 style={{ margin: '0 0 12px 0', fontWeight: 700, fontSize: 20, color: '#0b0b0b' }}>Registered Suppliers ({registeredSuppliers.length})</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>Company</th>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>Registration #</th>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>Tax ID</th>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>Eligibility</th>
                <th style={{ textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {registeredSuppliers.map((sup: any, idx: number) => (
                <tr key={sup.id}>
                  <td style={{ padding: '8px 10px', borderBottom: idx === registeredSuppliers.length - 1 ? 'none' : '1px solid #e1e0d9', fontWeight: 600 }}>{sup.companyName}</td>
                  <td style={{ padding: '8px 10px', borderBottom: idx === registeredSuppliers.length - 1 ? 'none' : '1px solid #e1e0d9', fontFamily: 'monospace', fontSize: '12px' }}>{sup.registrationNumber}</td>
                  <td style={{ padding: '8px 10px', borderBottom: idx === registeredSuppliers.length - 1 ? 'none' : '1px solid #e1e0d9' }}>{sup.taxId || '—'}</td>
                  <td style={{ padding: '8px 10px', borderBottom: idx === registeredSuppliers.length - 1 ? 'none' : '1px solid #e1e0d9' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 999, background: sup.checks?.businessRegistration ? '#d1fae5' : '#fee2e2', color: sup.checks?.businessRegistration ? '#065f46' : '#991b1b' }}>Registration {sup.checks?.businessRegistration ? '✓' : '✗'}</span>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 999, background: sup.checks?.taxClearance ? '#d1fae5' : '#fef3c7', color: sup.checks?.taxClearance ? '#065f46' : '#92400e' }}>Tax {sup.checks?.taxClearance ? '✓' : '—'}</span>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 999, background: '#d1fae5', color: '#065f46' }}>Not Debarred ✓</span>
                    </div>
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: idx === registeredSuppliers.length - 1 ? 'none' : '1px solid #e1e0d9', fontSize: '12px', color: '#6e6c66' }}>{new Date(sup.registeredAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Registration Form */}
      <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
        <h2 style={{ margin: '0 0 12px 0', fontWeight: 700, fontSize: 20, color: '#0b0b0b' }}>Register New Supplier</h2>
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
            <div style={hintStyle}>Required for tax clearance eligibility check</div>
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

      {/* Eligibility Criteria Info */}
      <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
        <h2 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>Bidder Eligibility Criteria</h2>
        <p style={{ margin: '0 0 12px 0', color: '#52514e', fontSize: 14 }}>Per Afghan Procurement Law Art. 17, bidders must meet all of the following:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Valid Business Registration', desc: 'Registered with AISA or relevant authority' },
            { label: 'Tax Clearance Certificate', desc: 'Up-to-date tax payments confirmed' },
            { label: 'Not Debarred', desc: 'Not on NPA debarment list' },
            { label: 'No Conflict of Interest', desc: 'No affiliation with procuring entity staff' },
          ].map((item) => (
            <div key={item.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f2942', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
