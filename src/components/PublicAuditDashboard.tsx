import { useState } from 'react';
import { Eye, Search, Download, TrendingUp, DollarSign, FileText, BarChart3, PieChart, Activity, Clock, CheckCircle, Shield, Filter, Link as LinkIcon, Flag, Coins } from 'lucide-react';
import { blockchain } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface PublicAuditDashboardProps {
  tenders: any[];
  bids: any[];
  contracts: any[];
  blockchainRecords: any[];
  userRole: string;
  walletBalance: number;
  setWalletBalance: (v: number) => void;
  walletTxs: any[];
  setWalletTxs: (txs: any[]) => void;
}

export function PublicAuditDashboard({ tenders, bids, contracts, blockchainRecords, userRole, walletBalance, setWalletBalance, walletTxs, setWalletTxs }: PublicAuditDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('all');
  const [flaggedTenders, setFlaggedTenders] = useState<Set<string>>(new Set());
  const [rewardNotification, setRewardNotification] = useState<{ id: string; amount: number } | null>(null);
  const { t } = useTranslation();

  const handleFlag = (tenderId: string) => {
    if (flaggedTenders.has(tenderId) || userRole !== 'citizen') return;
    const reward = 20;
    const rewardBlock = blockchain.addBlock({ type: 'citizen_flag_reward', tenderId, amount: reward, timestamp: Date.now() });
    setWalletBalance(walletBalance + reward);
    setWalletTxs([
      { id: rewardBlock.hash, type: 'reward', label: t('rewards.flagTender'), amount: reward, timestamp: Date.now() },
      ...walletTxs,
    ]);
    setFlaggedTenders(new Set([...flaggedTenders, tenderId]));
    setRewardNotification({ id: tenderId, amount: reward });
    setTimeout(() => setRewardNotification(null), 4000);
  };

  const totalBudget = tenders.reduce((sum, tender) => sum + Number(tender.budget || 0), 0);
  const totalAwarded = contracts.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const avgBidsPerTender = tenders.length > 0 ? (bids.length / tenders.length).toFixed(1) : 0;
  const completionRate = contracts.length > 0 
    ? ((contracts.filter(c => c.status === 'completed').length / contracts.length) * 100).toFixed(1)
    : 0;

  // Category breakdown
  const categoryData = tenders.reduce((acc: any, tender) => {
    const cat = tender.category || 'Other';
    if (!acc[cat]) acc[cat] = { count: 0, budget: 0 };
    acc[cat].count++;
    acc[cat].budget += Number(tender.budget || 0);
    return acc;
  }, {});

  const filteredTenders = searchQuery
    ? tenders.filter(
        (tender) =>
          tender.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tender.department.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tenders;

  const displayTenders = filterCategory === 'all'
    ? filteredTenders
    : filteredTenders.filter((tender) => tender.category === filterCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">{t('audit.title')}</h2>
          <p className="text-gray-600 mt-1">{t('audit.subtitle')}</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Download className="w-5 h-5" />
          {t('audit.exportReport')}
        </button>
      </div>

      {/* Reward Notification */}
      {rewardNotification && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-center gap-3">
          <Coins className="w-5 h-5 text-green-600" />
          <span className="flex-1 text-green-900 font-semibold">{t('rewards.awarded')}</span>
          <span className="text-green-800 font-bold text-lg">+{rewardNotification.amount} TOK</span>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-100" />
            <Activity className="w-6 h-6 opacity-100" />
          </div>
          <p className="opacity-100">{t('audit.totalBudget')}</p>
          <p className="mt-1">{totalBudget.toLocaleString()} {t('audit.afn')}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 opacity-100" />
            <TrendingUp className="w-6 h-6 opacity-100" />
          </div>
          <p className="opacity-100">{t('audit.activeTenders')}</p>
          <p className="mt-1">{tenders.filter((tender) => tender.status === 'published').length}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-8 h-8 opacity-100" />
            <Activity className="w-6 h-6 opacity-100" />
          </div>
          <p className="opacity-100">{t('audit.avgBids')}</p>
          <p className="mt-1">{avgBidsPerTender}</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <PieChart className="w-8 h-8 opacity-100" />
            <Activity className="w-6 h-6 opacity-100" />
          </div>
          <p className="opacity-100">{t('audit.completionRate')}</p>
          <p className="mt-1">{completionRate}%</p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h3 className="text-gray-900 mb-4">{t('audit.budgetDistribution')}</h3>
        <div className="space-y-3">
          {Object.entries(categoryData).map(([category, data]: [string, any]) => {
            const percentage = totalBudget > 0 ? ((data.budget / totalBudget) * 100).toFixed(1) : 0;
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-700">{category}</span>
                  <span className="text-gray-900">{data.budget.toLocaleString()} {t('audit.afn')} ({percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1 flex items-center gap-3 border border-gray-300 rounded-lg px-4 py-2">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('audit.searchPlaceholder')}
              className="flex-1 outline-none"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">{t('audit.allCategories')}</option>
            {Object.keys(categoryData).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tender List with Full Transparency */}
      <div className="space-y-4">
        <h3 className="text-gray-900">{t('audit.allRecords')}</h3>
        {displayTenders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('audit.noRecords')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayTenders.map((tender) => {
              const tenderBids = bids.filter((b) => b.tenderId === tender.id);
              const tenderContract = contracts.find((c) => c.tenderId === tender.id);
              const blockchainVerified = blockchainRecords.some((r) => r.tenderId === tender.id);

              return (
                <div key={tender.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-gray-900">{tender.title}</h4>
                        <span className={`px-3 py-1 rounded-full ${
                          tender.status === 'published' ? 'bg-green-100 text-green-900' :
                          tender.status === 'awarded' ? 'bg-blue-100 text-blue-900' :
                          'bg-amber-100 text-amber-900'
                        }`}>
                          {tender.status}
                        </span>
                        {blockchainVerified && (
                          <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
                            <Eye className="w-4 h-4" />
                            {t('audit.blockchainVerified')}
                          </span>
                        )}
                        {userRole === 'citizen' && !flaggedTenders.has(tender.id) && (
                          <button
                            onClick={() => handleFlag(tender.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-300 rounded-full text-xs font-semibold hover:bg-amber-100 transition-colors"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            {t('rewards.flagBtn')} (+20 TOK)
                          </button>
                        )}
                        {userRole === 'citizen' && flaggedTenders.has(tender.id) && (
                          <span className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                            <Flag className="w-3.5 h-3.5" />
                            {t('rewards.flagged')}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3">{tender.description}</p>

                      <div className="grid grid-cols-4 gap-4 text-gray-700 mb-4">
                        <div>
                          <p className="text-gray-500">{t('preTender.department')}</p>
                          <p>{tender.department}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('preTender.budget')}</p>
                          <p>{Number(tender.budget).toLocaleString()} {t('audit.afn')}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('preTender.category')}</p>
                          <p>{tender.category}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('preTender.submissionDeadline')}</p>
                          <p>{new Date(tender.deadline).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Bidding Information */}
                      {tenderBids.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-lg mb-3">
                          <p className="text-gray-700 mb-2">{tenderBids.length} {t('audit.bidsReceived')}</p>
                          <div className="space-y-2">
                            {tenderBids.map((bid, idx) => (
                              <div key={bid.id} className="flex items-center justify-between text-gray-600">
                                <span>{t('audit.bid')}#{idx + 1}: {bid.vendorName}</span>
                                <span>{Number(bid.amount).toLocaleString()} {t('audit.afn')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contract Award Information */}
                      {tenderContract && (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <p className="text-green-800 mb-2">{t('audit.contractAwarded')}</p>
                          <div className="grid grid-cols-3 gap-4 text-gray-700">
                            <div>
                              <p className="text-gray-600">{t('audit.awardedTo')}</p>
                              <p>{tenderContract.vendorName}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">{t('audit.amount')}</p>
                              <p>{Number(tenderContract.amount).toLocaleString()} {t('audit.afn')}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">{t('audit.progress')}</p>
                              <p>{tenderContract.progress}%</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chronological Audit Log */}
      {(() => {
        const typeLabels: Record<string, string> = {
          tender_created: t('audit.tenderCreated'),
          tender_published: t('audit.tenderPublished'),
          bid_submitted: t('audit.bidSubmitted'),
          contract_awarded: t('audit.contractAwarded'),
          payment_processed: t('audit.paymentProcessed'),
          dispute_raised: t('audit.disputeRaised'),
          report_submitted: t('audit.reportSubmitted'),
          wallet_transaction: t('audit.walletTransaction'),
        };

        const typeColors: Record<string, string> = {
          tender_created: 'bg-blue-100 text-blue-900',
          tender_published: 'bg-indigo-100 text-indigo-900',
          bid_submitted: 'bg-purple-100 text-purple-900',
          contract_awarded: 'bg-green-100 text-green-900',
          payment_processed: 'bg-amber-100 text-amber-900',
          dispute_raised: 'bg-red-100 text-red-900',
          report_submitted: 'bg-orange-100 text-orange-900',
          wallet_transaction: 'bg-cyan-100 text-cyan-900',
        };

        const typeIcons: Record<string, typeof FileText> = {
          tender_created: FileText,
          tender_published: FileText,
          bid_submitted: TrendingUp,
          contract_awarded: CheckCircle,
          payment_processed: LinkIcon,
          dispute_raised: Shield,
          report_submitted: Eye,
          wallet_transaction: DollarSign,
        };

        const getRecordDetails = (record: any) => {
          const tender = tenders.find((td) => td.id === record.tenderId);
          const bid = bids.find((b) => b.id === record.bidId);
          const contract = contracts.find((c) => c.id === record.contractId);

          switch (record.type) {
            case 'tender_created':
              return { actor: tender?.department || t('audit.systemActor'), detail: tender?.title || record.tenderId };
            case 'tender_published':
              return { actor: tender?.department || t('audit.systemActor'), detail: tender?.title || record.tenderId };
            case 'bid_submitted':
              return { actor: bid?.vendorName || t('audit.systemActor'), detail: `${tender?.title || ''} — ${Number(bid?.amount || 0).toLocaleString()} ${t('audit.afn')}` };
            case 'contract_awarded':
              return { actor: contract?.vendorName || t('audit.systemActor'), detail: tender?.title || record.tenderId };
            case 'payment_processed':
              return { actor: t('audit.systemActor'), detail: `${Number(record.amount || 0).toLocaleString()} ${t('audit.afn')}` };
            default:
              return { actor: t('audit.systemActor'), detail: typeLabels[record.type] || record.type };
          }
        };

        const sortedRecords = [...blockchainRecords].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        const uniqueTypes = [...new Set(blockchainRecords.map((r: any) => r.type))];

        const filteredRecords = sortedRecords.filter((record) => {
          if (auditFilter !== 'all' && record.type !== auditFilter) return false;
          if (auditSearch) {
            const q = auditSearch.toLowerCase();
            const details = getRecordDetails(record);
            return (
              (record.transactionHash || '').toLowerCase().includes(q) ||
              (typeLabels[record.type] || record.type).toLowerCase().includes(q) ||
              details.actor.toLowerCase().includes(q) ||
              details.detail.toLowerCase().includes(q)
            );
          }
          return true;
        });

        return (
          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="text-gray-900 font-semibold">{t('audit.auditLogTitle')}</h3>
                    <p className="text-gray-500 text-sm">{t('audit.auditLogSubtitle')}</p>
                  </div>
                </div>
                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                  {filteredRecords.length} {t('audit.entries')}
                </span>
              </div>

              {/* Filters */}
              <div className="flex gap-3">
                <div className="flex-1 flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder={t('audit.auditSearchPlaceholder')}
                    className="flex-1 outline-none text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    className="outline-none text-sm bg-transparent"
                  >
                    <option value="all">{t('audit.allActionTypes')}</option>
                    {uniqueTypes.map((type) => (
                      <option key={type} value={type}>{typeLabels[type] || type}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Log Entries */}
            {filteredRecords.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">{t('audit.noAuditEntries')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredRecords.map((record) => {
                  const details = getRecordDetails(record);
                  const TypeIcon = typeIcons[record.type] || Shield;
                  const colorClass = typeColors[record.type] || 'bg-gray-100 text-gray-800';

                  return (
                    <div key={record.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                          <TypeIcon className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
                              {typeLabels[record.type] || record.type}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(record.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-900">{details.actor}</span>
                            <span className="text-gray-400">—</span>
                            <span className="text-gray-600 truncate">{details.detail}</span>
                          </div>
                          {/* Transaction Hash */}
                          {(record.transactionHash || record.hash) && (
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-xs text-gray-400 font-mono">
                                {(record.transactionHash || record.hash).slice(0, 20)}...
                              </code>
                              {record.verified ? (
                                <span className="flex items-center gap-1 text-xs text-green-700">
                                  <CheckCircle className="w-3 h-3" />
                                  {t('audit.verified')}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-yellow-700">
                                  <Clock className="w-3 h-3" />
                                  {t('audit.unverified')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Transparency Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <Eye className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-blue-900 mb-2">{t('audit.transparencyTitle')}</h4>
            <p className="text-blue-800">
              {t('audit.transparencyText')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
