import { useState } from 'react';
import {
  Search,
  FileText,
  Gavel,
  AlertCircle,
  Shield,
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface SupplierTrackerProps {
  bids: any[];
  contracts: any[];
  disputes: any[];
  reports: any[];
  tenders: any[];
  blockchainRecords: any[];
}

// ─── Status Stepper ───────────────────────────────────────────────────────────

interface StepperProps {
  steps: string[];
  currentIndex: number; // 0-based index of the active step
}

function StatusStepper({ steps, currentIndex }: StepperProps) {
  return (
    <div className="flex items-center w-full">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentIndex;
        const isCurrent = idx === currentIndex;

        const circleClass = isCompleted
          ? 'bg-green-500 border-green-500 text-white'
          : isCurrent
          ? 'bg-blue-500 border-blue-500 text-white'
          : 'bg-white border-gray-300 text-gray-600';

        const lineClass = isCompleted ? 'bg-green-500' : 'bg-gray-200';

        return (
          <div key={idx} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold ${circleClass}`}
              >
                {isCompleted ? <CheckCircle className="w-4 h-4" /> : idx + 1}
              </div>
              <span
                className={`mt-1 text-xs text-center leading-tight max-w-[60px] ${
                  isCurrent
                    ? 'text-blue-600 font-semibold'
                    : isCompleted
                    ? 'text-green-600'
                    : 'text-gray-600'
                }`}
              >
                {step}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mt-[-14px] ${lineClass}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function bidStatusBadge(status: string) {
  const map: Record<string, string> = {
    submitted: 'bg-blue-100 text-blue-900',
    evaluated: 'bg-amber-100 text-amber-900',
    awarded: 'bg-green-100 text-green-900',
    rejected: 'bg-red-100 text-red-900',
  };
  return map[status] ?? 'bg-gray-100 text-gray-900';
}

function disputeStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-900',
    voting: 'bg-blue-100 text-blue-900',
    resolved: 'bg-green-100 text-green-900',
  };
  return map[status] ?? 'bg-gray-100 text-gray-900';
}

// ─── Step index helpers ───────────────────────────────────────────────────────

function bidStepIndex(status: string, t: (k: string) => string): number {
  // steps: Submitted → Under Review → Evaluated → Awarded/Rejected
  const map: Record<string, number> = {
    submitted: 0,
    under_review: 1,
    evaluated: 2,
    awarded: 3,
    rejected: 3,
  };
  return map[status] ?? 0;
}

function disputeStepIndex(status: string): number {
  // steps: Filed → Voting → Resolved
  const map: Record<string, number> = {
    pending: 0,
    filing: 0,
    voting: 1,
    resolved: 2,
  };
  return map[status] ?? 0;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SupplierTracker({
  bids,
  contracts,
  disputes,
  reports,
  tenders,
  blockchainRecords,
}: SupplierTrackerProps) {
  const { t } = useTranslation();
  const [supplierFilter, setSupplierFilter] = useState('');

  const filterLower = supplierFilter.trim().toLowerCase();

  // Filtered bids & contracts
  const myBids = filterLower
    ? bids.filter((b) => (b.vendorName ?? '').toLowerCase().includes(filterLower))
    : [];

  const myContracts = filterLower
    ? contracts.filter((c) => (c.vendorName ?? '').toLowerCase().includes(filterLower))
    : [];

  // Collect related IDs from my bids/contracts
  const myTenderIds = new Set([
    ...myBids.map((b) => b.tenderId),
    ...myContracts.map((c) => c.tenderId),
  ]);
  const myContractIds = new Set(myContracts.map((c) => c.id));

  // Filtered disputes: relatedId matches any tender or contract of this supplier
  const myDisputes = filterLower
    ? disputes.filter(
        (d) => myTenderIds.has(d.relatedId) || myContractIds.has(d.relatedId)
      )
    : [];

  // Filtered blockchain records
  const myAuditRecords = filterLower
    ? blockchainRecords.filter(
        (r) => myTenderIds.has(r.tenderId) || myContractIds.has(r.contractId)
      )
    : [];

  // Tender lookup map for bid display
  const tenderMap: Record<string, any> = {};
  tenders.forEach((t) => (tenderMap[t.id] = t));

  // Bid stepper steps
  const bidSteps = [
    t('supplier.stepSubmitted'),
    t('supplier.stepReview'),
    t('supplier.stepEvaluated'),
    t('supplier.stepAwarded'), // also used for rejected visually
  ];

  // Dispute stepper steps
  const disputeSteps = [
    t('supplier.stepFiled'),
    t('supplier.stepVoting'),
    t('supplier.stepResolved'),
  ];

  const hasFilter = filterLower.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-gray-900">{t('supplier.title')}</h2>
        <p className="text-gray-600 mt-1">{t('supplier.subtitle')}</p>
      </div>

      {/* Supplier Filter */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('supplier.searchLabel')}
        </label>
        <div className="flex items-center gap-3 border border-gray-300 rounded-lg px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="text"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            placeholder={t('supplier.searchPlaceholder')}
            className="flex-1 outline-none text-gray-900 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 opacity-100" />
            <TrendingUp className="w-6 h-6 opacity-100" />
          </div>
          <p className="opacity-100 text-sm">{t('supplier.myBids')}</p>
          <p className="text-3xl font-bold mt-1">{myBids.length}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-100" />
            <CheckCircle className="w-6 h-6 opacity-100" />
          </div>
          <p className="opacity-100 text-sm">{t('supplier.myContracts')}</p>
          <p className="text-3xl font-bold mt-1">{myContracts.length}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <Gavel className="w-8 h-8 opacity-100" />
            <AlertCircle className="w-6 h-6 opacity-100" />
          </div>
          <p className="opacity-100 text-sm">{t('supplier.myObjections')}</p>
          <p className="text-3xl font-bold mt-1">{myDisputes.length}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-8 h-8 opacity-100" />
            <Eye className="w-6 h-6 opacity-100" />
          </div>
          <p className="opacity-100 text-sm">{t('supplier.auditRecords')}</p>
          <p className="text-3xl font-bold mt-1">{myAuditRecords.length}</p>
        </div>
      </div>

      {/* Empty state when no filter entered */}
      {!hasFilter && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-12 text-center">
          <Search className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">{t('supplier.enterName')}</p>
        </div>
      )}

      {/* ── Bid Tracking ── */}
      {hasFilter && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-gray-900 font-semibold">{t('supplier.bidTracking')}</h3>
            <span className="ml-auto bg-blue-100 text-blue-900 text-xs font-semibold px-2 py-0.5 rounded-full">
              {myBids.length}
            </span>
          </div>

          {myBids.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-500">{t('supplier.noBids')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {myBids.map((bid) => {
                const tender = tenderMap[bid.tenderId];
                const stepIdx = bidStepIndex(bid.status, t);
                const isRejected = bid.status === 'rejected';

                // For rejected bids show a red last step label
                const steps = isRejected
                  ? [
                      t('supplier.stepSubmitted'),
                      t('supplier.stepReview'),
                      t('supplier.stepEvaluated'),
                      t('supplier.stepRejected'),
                    ]
                  : bidSteps;

                return (
                  <div key={bid.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {t('supplier.tender')}:{' '}
                          <span className="text-blue-700">
                            {tender?.title ?? bid.tenderId}
                          </span>
                        </p>
                        <div className="flex gap-6 mt-1 text-sm text-gray-500">
                          <span>
                            {t('supplier.amount')}:{' '}
                            <strong className="text-gray-800">
                              {Number(bid.amount ?? 0).toLocaleString()} {t('supplier.afn')}
                            </strong>
                          </span>
                          <span>
                            {t('supplier.submittedOn')}:{' '}
                            <strong className="text-gray-800">
                              {bid.submittedAt
                                ? new Date(bid.submittedAt).toLocaleDateString()
                                : '—'}
                            </strong>
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${bidStatusBadge(
                          bid.status
                        )}`}
                      >
                        {bid.status}
                      </span>
                    </div>

                    {/* Status stepper */}
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 mb-2 uppercase tracking-wide">
                        {t('supplier.progress')}
                      </p>
                      <StatusStepper steps={steps} currentIndex={stepIdx} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Objection & Dispute Tracking ── */}
      {hasFilter && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
            <Gavel className="w-5 h-5 text-orange-600" />
            <h3 className="text-gray-900 font-semibold">
              {t('supplier.objectionTracking')}
            </h3>
            <span className="ml-auto bg-orange-100 text-orange-900 text-xs font-semibold px-2 py-0.5 rounded-full">
              {myDisputes.length}
            </span>
          </div>

          {myDisputes.length === 0 ? (
            <div className="p-10 text-center">
              <Gavel className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-500">{t('supplier.noObjections')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {myDisputes.map((dispute) => {
                const stepIdx = disputeStepIndex(dispute.status);
                const isResolved = dispute.status === 'resolved';
                const votingDeadline = dispute.votingDeadline
                  ? new Date(dispute.votingDeadline)
                  : null;
                const daysLeft =
                  votingDeadline && !isResolved
                    ? Math.max(
                        0,
                        Math.ceil(
                          (votingDeadline.getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24)
                        )
                      )
                    : null;

                return (
                  <div key={dispute.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-medium text-gray-900">{dispute.title}</p>
                        <div className="flex gap-4 mt-1 text-sm text-gray-500">
                          <span>
                            {t('supplier.disputeType')}:{' '}
                            <strong className="text-gray-700">{dispute.type ?? '—'}</strong>
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${disputeStatusBadge(
                          dispute.status
                        )}`}
                      >
                        {dispute.status}
                      </span>
                    </div>

                    {/* Vote counts */}
                    <div className="flex gap-6 text-sm mb-4">
                      <div className="flex items-center gap-1 text-green-700">
                        <CheckCircle className="w-4 h-4" />
                        <span>
                          {t('supplier.votesFor')}: <strong>{dispute.votes?.approve ?? 0}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>
                          {t('supplier.votesAgainst')}:{' '}
                          <strong>{dispute.votes?.reject ?? 0}</strong>
                        </span>
                      </div>
                      {daysLeft !== null && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <Clock className="w-4 h-4" />
                          <span>
                            <strong>{daysLeft}</strong> {t('supplier.daysRemaining')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Resolution */}
                    {isResolved && dispute.resolution && (
                      <div className={`mb-4 border rounded-lg px-4 py-2 text-sm ${
                        dispute.resolution.decision === 'approved'
                          ? 'bg-green-50 border-green-200 text-green-800'
                          : 'bg-red-50 border-red-200 text-red-800'
                      }`}>
                        <ChevronRight className="inline w-4 h-4 mr-1" />
                        <strong>{t('supplier.resolution')}:</strong>{' '}
                        {dispute.resolution.decision === 'approved' ? t('supplier.approved') : t('supplier.rejected')}
                        {' '}({dispute.resolution.approvalRate?.toFixed(1)}%)
                      </div>
                    )}

                    {/* Stepper */}
                    <div className="mt-2">
                      <StatusStepper steps={disputeSteps} currentIndex={stepIdx} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Audit Report Tracking ── */}
      {hasFilter && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
            <Shield className="w-5 h-5 text-purple-600" />
            <h3 className="text-gray-900 font-semibold">{t('supplier.auditTrail')}</h3>
            <span className="ml-auto bg-purple-100 text-purple-900 text-xs font-semibold px-2 py-0.5 rounded-full">
              {myAuditRecords.length}
            </span>
          </div>

          {myAuditRecords.length === 0 ? (
            <div className="p-10 text-center">
              <Shield className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-500">{t('supplier.noAuditRecords')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                    <th className="px-6 py-3 text-left">{t('supplier.recordType')}</th>
                    <th className="px-6 py-3 text-left">{t('supplier.txHash')}</th>
                    <th className="px-6 py-3 text-left">{t('supplier.timestamp')}</th>
                    <th className="px-6 py-3 text-left">{t('supplier.status')}</th>
                    <th className="px-6 py-3 text-left">{t('supplier.tender')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myAuditRecords.map((record) => {
                    const relatedTender = tenderMap[record.tenderId];
                    const txHash = record.transactionHash || record.hash || '';
                    const shortHash = txHash
                      ? `${txHash.slice(0, 8)}...${txHash.slice(-6)}`
                      : '—';

                    return (
                      <tr
                        key={record.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-900 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize">
                            <FileText className="w-3 h-3" />
                            {(record.type ?? '').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-600">
                          {shortHash}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {record.timestamp
                            ? new Date(record.timestamp).toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-6 py-4">
                          {record.verified !== false ? (
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-900 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                              <CheckCircle className="w-3 h-3" />
                              {t('supplier.verified')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-900 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                              <AlertCircle className="w-3 h-3" />
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {relatedTender?.title ?? record.tenderId ?? record.contractId ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex gap-4">
        <AlertCircle className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-800 mb-1">{t('supplier.infoTitle')}</p>
          <p className="text-blue-700 text-sm leading-relaxed">{t('supplier.infoText')}</p>
        </div>
      </div>
    </div>
  );
}
