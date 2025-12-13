import { useState } from 'react';
import { Award, CheckCircle, DollarSign, Calendar, FileText, TrendingUp, Shield, AlertCircle } from 'lucide-react';
import { addProcurementRecord } from '../utils/blockchain';

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
  const [evaluationScores, setEvaluationScores] = useState<{ [key: string]: number }>({});

  const tendersWithBids = tenders.filter((t) => {
    const tenderBids = bids.filter((b) => b.tenderId === t.id);
    return tenderBids.length > 0 && t.status === 'published';
  });

  const getTenderBids = (tenderId: string) => {
    return bids.filter((b) => b.tenderId === tenderId);
  };

  const evaluateBid = (bidId: string, score: number) => {
    setEvaluationScores({ ...evaluationScores, [bidId]: score });
  };

  const awardContract = (tender: any, bid: any) => {
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

    // Add to blockchain
    const { block, contract } = addProcurementRecord('award', {
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
      verified: true,
    };

    // Update tender status
    const updatedTenders = tenders.map((t) =>
      t.id === tender.id ? { ...t, status: 'awarded' } : t
    );

    setContracts([...contracts, newContract]);
    setTenders(updatedTenders);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setSelectedTender(null);
  };

  const processMilestonePayment = (contractId: string, milestoneId: number) => {
    const updatedContracts = contracts.map((c) => {
      if (c.id === contractId) {
        const updatedMilestones = c.milestones.map((m: any) =>
          m.id === milestoneId ? { ...m, status: 'paid', paidAt: new Date().toISOString() } : m
        );
        const progress = (updatedMilestones.filter((m: any) => m.status === 'paid').length / updatedMilestones.length) * 100;

        // Add payment to blockchain
        const milestone = c.milestones.find((m: any) => m.id === milestoneId);
        const { block, contract } = addProcurementRecord('payment', {
          contractId: c.id,
          amount: milestone.amount,
          milestone: milestone.name,
        });

        const blockchainRecord = {
          id: block.hash,
          type: 'payment_processed',
          contractId: c.id,
          milestoneId,
          smartContractId: contract.id,
          transactionHash: contract.transactionHash,
          amount: milestone.amount,
          timestamp: new Date().toISOString(),
          verified: true,
        };

        setBlockchainRecords([...blockchainRecords, blockchainRecord]);

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
      {/* Header */}
      <div>
        <h2 className="text-gray-900">Post-Tendering Phase</h2>
        <p className="text-gray-600 mt-1">Evaluate bids, award contracts, and manage payments</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Total Bids</p>
              <p className="text-gray-900 mt-1">{bids.length}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Active Contracts</p>
              <p className="text-gray-900 mt-1">{contracts.filter((c) => c.status === 'active').length}</p>
            </div>
            <Award className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Completed</p>
              <p className="text-gray-900 mt-1">{contracts.filter((c) => c.status === 'completed').length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Total Value</p>
              <p className="text-gray-900 mt-1">
                {contracts.reduce((sum, c) => sum + Number(c.amount), 0).toLocaleString()} AFN
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Bid Evaluation Section */}
      <div className="space-y-4">
        <h3 className="text-gray-900">Bid Evaluation & Contract Award</h3>

        {tendersWithBids.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No tenders with bids available for evaluation</p>
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
                        <p className="text-gray-600 mt-1">{tenderBids.length} bids received</p>
                      </div>
                      {isAwarded ? (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">
                          Contract Awarded
                        </span>
                      ) : (
                        <button
                          onClick={() => setSelectedTender(selectedTender?.id === tender.id ? null : tender)}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Award className="w-4 h-4" />
                          Evaluate & Award
                        </button>
                      )}
                    </div>

                    {selectedTender?.id === tender.id && !isAwarded && (
                      <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-gray-900">Bid Evaluation</h5>
                        {tenderBids.map((bid) => (
                          <div key={bid.id} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-gray-900">{bid.vendorName}</span>
                                  <Shield className="w-4 h-4 text-green-600" />
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-gray-600 mb-3">
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" />
                                    {Number(bid.amount).toLocaleString()} AFN
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {bid.timeline}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-gray-700">Technical Proposal:</p>
                                    <p className="text-gray-600">{bid.technicalProposal}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-700">Experience:</p>
                                    <p className="text-gray-600">{bid.experience}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <label className="block text-gray-700 mb-2">Evaluation Score (0-100)</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={evaluationScores[bid.id] || ''}
                                  onChange={(e) => evaluateBid(bid.id, Number(e.target.value))}
                                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  placeholder="Enter score"
                                />
                              </div>
                              <button
                                onClick={() => awardContract(tender, bid)}
                                disabled={!evaluationScores[bid.id] || evaluationScores[bid.id] < 70}
                                className="mt-6 flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                              >
                                <Award className="w-4 h-4" />
                                Award Contract
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

      {/* Active Contracts */}
      <div className="space-y-4">
        <h3 className="text-gray-900">Contract Management</h3>

        {contracts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No contracts awarded yet</p>
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
                        <span
                          className={`px-3 py-1 rounded-full ${
                            contract.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {contract.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-gray-600">
                        <div className="flex items-center gap-2">
                          <span>Vendor: {contract.vendorName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          {Number(contract.amount).toLocaleString()} AFN
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {contract.timeline}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-700">Overall Progress</span>
                      <span className="text-gray-900">{contract.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${contract.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Milestones */}
                  <div className="space-y-3">
                    <h5 className="text-gray-900">Payment Milestones</h5>
                    {contract.milestones.map((milestone: any) => (
                      <div key={milestone.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-900">{milestone.name}</span>
                            {milestone.status === 'paid' && (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <DollarSign className="w-4 h-4" />
                            {Number(milestone.amount).toLocaleString()} AFN
                          </div>
                        </div>
                        {milestone.status === 'pending' ? (
                          <button
                            onClick={() => processMilestonePayment(contract.id, milestone.id)}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Shield className="w-4 h-4" />
                            Process Payment
                          </button>
                        ) : (
                          <span className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            Paid
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