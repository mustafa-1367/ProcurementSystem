import { Briefcase, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface MyContractsProps {
  contracts: any[];
  bids: any[];
  tenders: any[];
}

export function MyContracts({ contracts, bids, tenders }: MyContractsProps) {
  const { t } = useTranslation();

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'active': return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 text-green-700';
      case 'active': return 'bg-blue-50 text-blue-700';
      default: return 'bg-yellow-50 text-yellow-700';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 text-xl font-semibold">{t('myContracts.title')}</h2>
        <p className="text-gray-600 mt-1">{t('myContracts.subtitle')}</p>
      </div>

      {/* Summary Stats — Sharakat Chain style */}
      <div className="mobile-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#0b0b0b' }}>{contracts.length}</div>
          <div style={{ color: '#6e6c66', fontSize: 12, marginTop: 2 }}>{t('myContracts.totalContracts')}</div>
        </div>
        <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#0b0b0b' }}>{contracts.filter(c => c.status === 'active').length}</div>
          <div style={{ color: '#6e6c66', fontSize: 12, marginTop: 2 }}>{t('myContracts.activeContracts')}</div>
        </div>
        <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#0b0b0b' }}>{contracts.filter(c => c.status === 'completed').length}</div>
          <div style={{ color: '#6e6c66', fontSize: 12, marginTop: 2 }}>{t('myContracts.completedContracts')}</div>
        </div>
      </div>

      {/* Contracts List */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-blue-600" />
          <h3 className="text-gray-900 font-semibold">{t('myContracts.listTitle')}</h3>
        </div>
        {contracts.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">{t('myContracts.noContracts')}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {contracts.map((contract: any) => (
              <div key={contract.id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {contract.tenderTitle || contract.title || contract.id}
                    </div>
                    <div className="text-sm text-gray-500">
                      {contract.id} &middot; {contract.awardedAt ? new Date(contract.awardedAt).toLocaleDateString() : ''}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle(contract.status)}`}>
                    {statusIcon(contract.status)}
                    {contract.status}
                  </span>
                </div>
                {contract.vendor && (
                  <div className="text-sm text-gray-600">{t('myContracts.vendor')}: {contract.vendor}</div>
                )}
                {contract.amount && (
                  <div className="text-sm text-gray-600">{t('myContracts.amount')}: {Number(contract.amount).toLocaleString()} AFN</div>
                )}
                {contract.milestones && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">{t('myContracts.milestones')}</div>
                    <div className="flex gap-1">
                      {contract.milestones.map((m: any, i: number) => (
                        <div
                          key={i}
                          className={`h-2 flex-1 rounded-full ${m.status === 'paid' || m.completed ? 'bg-green-400' : 'bg-gray-200'}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
