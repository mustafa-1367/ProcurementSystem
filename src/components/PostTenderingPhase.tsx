import { useState } from 'react';
import { Award, CheckCircle, Banknote, Calendar, FileText, TrendingUp, Shield, AlertCircle } from 'lucide-react';
import { addProcurementRecordAsync } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface PostTenderingPhaseProps {
  tenders: any[];
  bids: any[];
  contracts: any[];
  setContracts: (contracts: any[]) => void;
  setTenders: (tenders: any[]) => void;
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
  setReputationScores: (scores: any[]) => void;
  reputationScores: any[];
}

export function PostTenderingPhase({
  tenders,
  bids,
  contracts,
  setContracts,
  setTenders,
  setBlockchainRecords,
  blockchainRecords,
  setReputationScores,
  reputationScores,
}: PostTenderingPhaseProps) {
  const [selectedTender, setSelectedTender] = useState<any>(null);
  const [evaluationScores, setEvaluationScores] = useState<{ [key: string]: string }>({});
  const [scoreErrors, setScoreErrors] = useState<{ [key: string]: string }>({});
  const { t } = useTranslation();

  const tendersWithBids = tenders.filter((td) => {
    const tenderBids = bids.filter((b) => b.tenderId === td.id);
    return tenderBids.length > 0 && td.status === 'published';
  });

  const getTenderBids = (tenderId: string) => bids.filter((b) => b.tenderId === tenderId);

  const evaluateBid = (bidId: string, value: string) => {
    setEvaluationScores({ ...evaluationScores, [bidId]: value });
    setScoreErrors({ ...scoreErrors, [bidId]: '' });
  };

  const validateScore = (bidId: string): number | null => {
    const value = evaluationScores[bidId] || '';
    if (!value.trim()) {
      setScoreErrors({ ...scoreErrors, [bidId]: t('postTender.scoreRequired') });
      return null;
    }
    const num = Number(value);
    if (isNaN(num) || !Number.isFinite(num) || value.trim() !== String(num)) {
      setScoreErrors({ ...scoreErrors, [bidId]: t('postTender.scoreNumbersOnly') });
      return null;
    }
    if (num < 0 || num > 100) {
      setScoreErrors({ ...scoreErrors, [bidId]: t('postTender.scoreRange') });
      return null;
    }
    return num;
  };

  const awardContract = async (tender: any, bid: any) => {
    const newContract = {
      id: `CNT-${Date.now()}`,
      tenderId: tender.id,
      tenderTitle: tender.title,
      bidId: bid.id,
      vendorName: bid.vendorName,
      vendorEmail: bid.vendorEmail,
      amount: bid.amount,
      timeline: bid.timeline,
      status: 'active',
      awardedAt: new Date().toISOString(),
      milestones: [
        { id: 1, name: 'Initial Payment (30%)', percentage: 30, status: 'pending', amount: Number(bid.amount) * 0.3 },
        { id: 2, name: 'Mid-project Payment (40%)', percentage: 40, status: 'pending', amount: Number(bid.amount) * 0.4 },
        { id: 3, name: 'Final Payment (30%)', percentage: 30, status: 'pending', amount: Number(bid.amount) * 0.3 },
      ],
      progress: 0,
    };

    const { block, contract, onChain } = await addProcurementRecordAsync('award', {
      tenderId: tender.id,
      bidderId: bid.id,
      amount: bid.amount,
      vendor: bid.vendorName,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'contract_awarded',
      tenderId: tender.id,
      contractId: newContract.id,
      smartContractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain, simulated: !onChain, onChain,
    };

    const updatedTenders = tenders.map((td) =>
      td.id === tender.id ? { ...td, status: 'awarded' } : td
    );

    setContracts([...contracts, newContract]);
    setTenders(updatedTenders);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setSelectedTender(null);
  };

  const processMilestonePayment = async (contractId: string, milestoneId: number) => {
    const targetContract = contracts.find((c) => c.id === contractId);
    if (!targetContract) return;

    const milestone = targetContract.milestones.find((m: any) => m.id === milestoneId);
    if (!milestone) return;

    const { block, contract, onChain } = await addProcurementRecordAsync('payment', {
      contractId,
      amount: milestone.amount,
      milestone: milestone.name,
      milestoneId,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'payment_processed',
      contractId,
      milestoneId,
      smartContractId: contract.id,
      transactionHash: contract.transactionHash,
      amount: milestone.amount,
      timestamp: new Date().toISOString(),
      verified: onChain, simulated: !onChain, onChain,
    };

    setBlockchainRecords([...blockchainRecords, blockchainRecord]);

    const updatedContracts = contracts.map((c) => {
      if (c.id === contractId) {
        const updatedMilestones = c.milestones.map((m: any) =>
          m.id === milestoneId ? { ...m, status: 'paid', paidAt: new Date().toISOString() } : m
        );
        const progress = (updatedMilestones.filter((m: any) => m.status === 'paid').length / updatedMilestones.length) * 100;
        return {
          ...c,
          milestones: updatedMilestones,
          progress,
          status: progress === 100 ? 'completed' : 'active',
        };
      }
      return c;
    });

    setContracts(updatedContracts);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900">{t('postTender.title')}</h2>
        <p className="text-gray-600 mt-1">{t('postTender.subtitle')}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('postTender.totalBids')}</p>
              <p className="text-gray-900 mt-1">{bids.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('postTender.activeContracts')}</p>
              <p className="text-gray-900 mt-1">{contracts.filter((c) => c.status === 'active').length}</p>
            </div>
            <Award className="w-8 h-8 text-green-700" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('postTender.completed')}</p>
              <p className="text-gray-900 mt-1">{contracts.filter((c) => c.status === 'completed').length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('postTender.totalValue')}</p>
              <p className="text-gray-900 mt-1">
                {contracts.reduce((sum, c) => sum + Number(c.amount), 0).toLocaleString()} {t('postTender.afn')}
              </p>
            </div>
            <Banknote className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-gray-900">{t('postTender.bidEvaluation')}</h3>
        {tendersWithBids.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('postTender.noTendersWithBids')}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {tendersWithBids.map((tender) => {
              const tenderBids = getTenderBids(tender.id);
              const isAwarded = tender.status === 'awarded';
              return (
                <div key={tender.id} className="bg-white rounded-lg shadow-md border border-gray-200">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-gray-900">{tender.title}</h4>
                        <p className="text-gray-600 mt-1">{tenderBids.length} {t('postTender.bidsReceived')}</p>
                      </div>
                      {isAwarded ? (
                        <span className="px-3 py-1 bg-green-100 text-green-900 rounded-full">
                          {t('postTender.contractAwarded')}
                        </span>
                      ) : (
                        <button
                          onClick={() => setSelectedTender(selectedTender?.id === tender.id ? null : tender)}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Award className="w-4 h-4" />
                          {t('postTender.evaluateAward')}
                        </button>
                      )}
                    </div>
                    {selectedTender?.id === tender.id && !isAwarded && (
                      <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-gray-900">{t('postTender.bidEvaluationTitle')}</h5>
                        {tenderBids.map((bid) => (
                          <div key={bid.id} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-gray-900">{bid.vendorName}</span>
                                  <Shield className="w-4 h-4 text-green-700" />
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-gray-600 mb-3">
                                  <div className="flex items-center gap-2">
                                    <Banknote className="w-4 h-4" />
                                    {Number(bid.amount).toLocaleString()} {t('postTender.afn')}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {bid.timeline}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-gray-700">{t('postTender.technicalProposal')}</p>
                                    <p className="text-gray-600">{bid.technicalProposal}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-700">{t('postTender.experience')}</p>
                                    <p className="text-gray-600">{bid.experience}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <label className="block text-gray-700 mb-2">{t('postTender.evaluationScore')}</label>
                                <input
                                  type="text"
                                  value={evaluationScores[bid.id] || ''}
                                  onChange={(e) => evaluateBid(bid.id, e.target.value)}
                                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${scoreErrors[bid.id] ? 'border-red-500' : 'border-gray-300'}`}
                                  placeholder={t('postTender.enterScore')}
                                />
                                {scoreErrors[bid.id] && (
                                  <p className="text-red-600 text-sm mt-1">{scoreErrors[bid.id]}</p>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  const score = validateScore(bid.id);
                                  if (score !== null && score >= 70) awardContract(tender, bid);
                                  else if (score !== null && score < 70) setScoreErrors({ ...scoreErrors, [bid.id]: t('postTender.scoreMinimum') });
                                }}
                                className="mt-6 flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <Award className="w-4 h-4" />
                                {t('postTender.awardContract')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-gray-900">{t('postTender.contractManagement')}</h3>
        {contracts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('postTender.noContractsYet')}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {contracts.map((contract) => (
              <div key={contract.id} className="bg-white rounded-lg shadow-md border border-gray-200">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-gray-900">{contract.tenderTitle}</h4>
                        <span className={`px-3 py-1 rounded-full ${
                          contract.status === 'completed' ? 'bg-green-100 text-green-900' : 'bg-blue-100 text-blue-900'
                        }`}>
                          {contract.status === 'completed' ? t('postTender.completed') : t('postTender.active')}
                        </span>
                        {blockchainRecords.some(r => r.contractId === contract.id && r.onChain) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>● On-Chain</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-gray-600">
                        <div className="flex items-center gap-2">
                          <span>{t('postTender.vendor')} {contract.vendorName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Banknote className="w-4 h-4" />
                          {Number(contract.amount).toLocaleString()} {t('postTender.afn')}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {contract.timeline}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-700">{t('postTender.overallProgress')}</span>
                      <span className="text-gray-900">{contract.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full transition-all" style={{ width: `${contract.progress}%` }}></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h5 className="text-gray-900">{t('postTender.paymentMilestones')}</h5>
                    {contract.milestones.map((milestone: any) => (
                      <div key={milestone.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-900">{milestone.name}</span>
                            {milestone.status === 'paid' && <CheckCircle className="w-4 h-4 text-green-700" />}
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Banknote className="w-4 h-4" />
                            {Number(milestone.amount).toLocaleString()} {t('postTender.afn')}
                          </div>
                        </div>
                        {milestone.status === 'pending' ? (
                          <button
                            onClick={() => processMilestonePayment(contract.id, milestone.id)}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Shield className="w-4 h-4" />
                            {t('postTender.processPayment')}
                          </button>
                        ) : (
                          <span className="flex items-center gap-2 text-green-700">
                            <CheckCircle className="w-5 h-5" />
                            {t('postTender.paid')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
