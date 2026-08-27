import React from 'react';
import { FileText, Eye, AlertTriangle, CreditCard, PlusCircle } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface ProcurementDashboardProps {
  setActivePhase: (p: any) => void;
  setShowWallet: (v: boolean) => void;
  tenders: any[];
  bids: any[];
  contracts: any[];
  reports: any[];
  blockchainRecords: any[];
  setTenders: (t: any[]) => void;
  setBids: (b: any[]) => void;
  setContracts: (c: any[]) => void;
  setReports: (r: any[]) => void;
  setBlockchainRecords: (r: any[]) => void;
  userRole: string;
}

export function ProcurementDashboard({
  setActivePhase,
  setShowWallet,
  tenders,
  bids,
  contracts,
  reports,
  blockchainRecords,
  userRole,
}: ProcurementDashboardProps) {
  const { t } = useTranslation();

  // ── Bidder (supplier) dashboard — Sharakat Chain style ──
  if (userRole === 'supplier') {
    const activeBids = bids.filter((b) => b.status === 'submitted').length;
    const activeContracts = contracts.filter((c) => c.status === 'active').length;
    const pendingMilestones = contracts.reduce((sum, c) => {
      if (!c.milestones) return sum;
      return sum + c.milestones.filter((m: any) => m.status === 'pending').reduce((s: number, m: any) => s + (m.amount || 0), 0);
    }, 0);
    const totalDelivered = contracts.length > 0
      ? Math.round(contracts.reduce((sum, c) => sum + (c.progress || 0), 0) / contracts.length)
      : 0;

    const recentActivity = [
      ...bids.slice().reverse().slice(0, 5).map((bid) => ({
        tender: `${bid.tenderId} — ${bid.tenderTitle}`,
        stage: bid.evaluated ? t('bidderDash.evaluated') : t('bidderDash.underEvaluation'),
        status: bid.evaluated ? t('bidderDash.evaluated') : t('bidderDash.underEvaluation'),
        statusClass: bid.evaluated ? 'b-good' : 'b-warn',
      })),
      ...contracts.slice().reverse().slice(0, 3).map((c) => ({
        tender: `${c.tenderId} — ${c.tenderTitle}`,
        stage: t('bidderDash.contractSigned'),
        status: t('bidderDash.contractSigned'),
        statusClass: 'b-good',
      })),
    ].slice(0, 5);

    const statStyle: React.CSSProperties = {
      background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 16,
    };
    const valStyle: React.CSSProperties = {
      fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#0b0b0b',
    };
    const lblStyle: React.CSSProperties = { color: '#6e6c66', fontSize: 12, marginTop: 2 };
    const thStyle: React.CSSProperties = {
      textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px',
      textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px',
    };

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', color: '#0b0b0b' }}>
              {t('bidderDash.title')}
            </h1>
            <p style={{ margin: '0 0 10px 0', color: '#52514e' }}>{t('bidderDash.subtitle')}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          <div style={statStyle}>
            <div style={valStyle}>{activeBids}</div>
            <div style={lblStyle}>{t('bidderDash.activeBids')}</div>
          </div>
          <div style={statStyle}>
            <div style={valStyle}>{activeContracts}</div>
            <div style={lblStyle}>{t('bidderDash.contractsInProgress')}</div>
          </div>
          <div style={statStyle}>
            <div style={valStyle}>${pendingMilestones.toLocaleString()}</div>
            <div style={lblStyle}>{t('bidderDash.pendingMilestones')}</div>
          </div>
          <div style={statStyle}>
            <div style={valStyle}>{totalDelivered}%</div>
            <div style={lblStyle}>{t('bidderDash.onTimeDelivery')}</div>
          </div>
        </div>

        <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
          <h2 style={{ margin: '0 0 10px 0', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>
            {t('bidderDash.recentActivity')}
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr>
                <th style={thStyle}>{t('bidderDash.colTender')}</th>
                <th style={thStyle}>{t('bidderDash.colStage')}</th>
                <th style={thStyle}>{t('bidderDash.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '20px 10px', color: '#6e6c66', textAlign: 'center' }}>
                    {t('bidderDash.noActivity')}
                  </td>
                </tr>
              ) : (
                recentActivity.map((row, i) => (
                  <tr key={i} style={{ cursor: 'default' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8f8f6'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '10px', borderBottom: i < recentActivity.length - 1 ? '1px solid #e1e0d9' : 'none', verticalAlign: 'top' }}>
                      {row.tender}
                    </td>
                    <td style={{ padding: '10px', borderBottom: i < recentActivity.length - 1 ? '1px solid #e1e0d9' : 'none', verticalAlign: 'top' }}>
                      {row.stage}
                    </td>
                    <td style={{ padding: '10px', borderBottom: i < recentActivity.length - 1 ? '1px solid #e1e0d9' : 'none', verticalAlign: 'top' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: '11.5px', fontWeight: 700, padding: '3px 9px',
                        borderRadius: 999, border: '1px solid', whiteSpace: 'nowrap',
                        ...(row.statusClass === 'b-good' ? { color: '#0a6b0a', background: '#eaf8ea', borderColor: '#c7ecc7' } :
                          row.statusClass === 'b-warn' ? { color: '#8a5a12', background: '#fdf3df', borderColor: '#f0dcae' } :
                          row.statusClass === 'b-info' ? { color: '#1c5cab', background: '#eef5fd', borderColor: '#bcd6f5' } :
                          { color: '#52514e', background: '#f0efec', borderColor: '#e1e0d9' }),
                      }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Default dashboard for all other roles ──
  const published = tenders.filter((tender) => tender.status === 'published').length;
  const drafts = tenders.filter((tender) => tender.status === 'draft').length;
  const totalBids = bids.length;
  const totalReports = reports.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">{
            userRole === 'government' ? t('dashboard.titleEntity') :
            userRole === 'citizen' ? t('dashboard.titlePublic') :
            userRole === 'auditor' ? t('dashboard.titleAuditor') :
            userRole === 'oversight' ? t('dashboard.titleOversight') :
            t('dashboard.title')
          }</h2>
          <p className="text-gray-600 mt-1">{
            userRole === 'government' ? t('dashboard.subtitleEntity') :
            userRole === 'citizen' ? t('dashboard.subtitlePublic') :
            userRole === 'auditor' ? t('dashboard.subtitleAuditor') :
            userRole === 'oversight' ? t('dashboard.subtitleOversight') :
            t('dashboard.subtitle')
          }</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWallet(true)}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 hover:shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <CreditCard className="w-4 h-4 text-gray-700" />
            <span className="text-gray-700">{t('dashboard.openWallet')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <p className="text-gray-500">{t('dashboard.tenders')}</p>
              <p className="text-gray-900 text-lg">{tenders.length}</p>
            </div>
          </div>
          <div className="flex gap-2 text-sm text-gray-600">
            <div>{t('dashboard.published')}: {published}</div>
            <div>{t('dashboard.drafts')}: {drafts}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-6 h-6 text-purple-600" />
            <div>
              <p className="text-gray-500">{t('dashboard.auditRecords')}</p>
              <p className="text-gray-900 text-lg">{blockchainRecords.length}</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">{t('dashboard.verifiable')}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <div>
              <p className="text-gray-500">{t('dashboard.whistleblower')}</p>
              <p className="text-gray-900 text-lg">{totalReports}</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">{t('dashboard.protectedAnonymous')}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <PlusCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="text-gray-500">{t('dashboard.quickActions')}</p>
              <p className="text-gray-900 text-lg">{totalBids} {t('dashboard.bids')}</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">{t('dashboard.quickActionsDesc')}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {userRole === 'government' && (
          <button
            onClick={() => setActivePhase('pre')}
            className="col-span-1 bg-blue-600 text-white px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> {t('dashboard.createTender')}
          </button>
        )}

        {userRole === 'government' && (
          <button
            onClick={() => setActivePhase('tender')}
            className="col-span-1 bg-indigo-600 text-white px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> {t('dashboard.goToTendering')}
          </button>
        )}

        {userRole !== 'government' && (
          <button
            onClick={() => setActivePhase('audit')}
            className="col-span-1 bg-green-600 text-white px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <Eye className="w-4 h-4" /> {t('dashboard.openPublicAudit')}
          </button>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-gray-900">{t('dashboard.recentTenders')}</h3>
        {tenders.slice().reverse().slice(0, 4).map((tender) => (
          <div key={tender.id} className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-900 font-medium">{tender.title}</div>
                <div className="text-gray-600 text-sm">{tender.department} • {tender.category}</div>
              </div>
              <div className="text-gray-700">{tender.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProcurementDashboard;
