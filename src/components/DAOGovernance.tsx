import { useState } from 'react';
import { Users, Vote, AlertCircle, CheckCircle, XCircle, MessageSquare, TrendingUp, Shield } from 'lucide-react';
import { addProcurementRecord } from '../utils/blockchain';

interface DAOGovernanceProps {
  disputes: any[];
  setDisputes: (disputes: any[]) => void;
  tenders: any[];
  contracts: any[];
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
}

export function DAOGovernance({ 
  disputes, 
  setDisputes, 
  tenders,
  contracts,
  setBlockchainRecords, 
  blockchainRecords 
}: DAOGovernanceProps) {
  const [showCreateDispute, setShowCreateDispute] = useState(false);
  const [disputeForm, setDisputeForm] = useState({
    title: '',
    description: '',
    relatedId: '',
    type: '',
    evidence: '',
  });
  const [userVotes, setUserVotes] = useState<{ [key: string]: 'approve' | 'reject' }>({});

  const handleCreateDispute = (e: React.FormEvent) => {
    e.preventDefault();

    const newDispute = {
      id: `DSP-${Date.now()}`,
      ...disputeForm,
      status: 'voting',
      createdAt: new Date().toISOString(),
      votes: {
        approve: 0,
        reject: 0,
        totalVoters: 0,
      },
      votingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      resolution: null,
    };

    // Add to blockchain
    const { block, contract } = addProcurementRecord('dispute', {
      disputeId: newDispute.id,
      title: disputeForm.title,
      type: disputeForm.type,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'dispute_created',
      disputeId: newDispute.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: true,
    };

    setDisputes([...disputes, newDispute]);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setShowCreateDispute(false);
    setDisputeForm({
      title: '',
      description: '',
      relatedId: '',
      type: '',
      evidence: '',
    });
  };

  const castVote = (disputeId: string, vote: 'approve' | 'reject') => {
    // Record user's vote
    setUserVotes({ ...userVotes, [disputeId]: vote });

    // Update dispute votes
    const updatedDisputes = disputes.map((d) => {
      if (d.id === disputeId) {
        const newVotes = {
          approve: d.votes.approve + (vote === 'approve' ? 1 : 0),
          reject: d.votes.reject + (vote === 'reject' ? 1 : 0),
          totalVoters: d.votes.totalVoters + 1,
        };

        // Auto-resolve if threshold reached (e.g., 10 votes)
        let status = d.status;
        let resolution = d.resolution;
        
        if (newVotes.totalVoters >= 10) {
          const approvalRate = (newVotes.approve / newVotes.totalVoters) * 100;
          status = 'resolved';
          resolution = {
            decision: approvalRate >= 60 ? 'approved' : 'rejected',
            approvalRate,
            resolvedAt: new Date().toISOString(),
          };

          // Add resolution to blockchain
          const { block, contract } = addProcurementRecord('dao_resolution', {
            disputeId,
            decision: resolution.decision,
            approvalRate,
          });

          const blockchainRecord = {
            id: block.hash,
            type: 'dao_resolution',
            disputeId,
            contractId: contract.id,
            transactionHash: contract.transactionHash,
            decision: resolution.decision,
            timestamp: new Date().toISOString(),
            verified: true,
          };

          setBlockchainRecords([...blockchainRecords, blockchainRecord]);
        }

        return { ...d, votes: newVotes, status, resolution };
      }
      return d;
    });

    setDisputes(updatedDisputes);
  };

  const activeDisputes = disputes.filter((d) => d.status === 'voting');
  const resolvedDisputes = disputes.filter((d) => d.status === 'resolved');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">DAO Governance & Dispute Resolution</h2>
          <p className="text-gray-600 mt-1">Decentralized decision-making for procurement disputes</p>
        </div>
        <button
          onClick={() => setShowCreateDispute(!showCreateDispute)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <AlertCircle className="w-5 h-5" />
          Raise Dispute
        </button>
      </div>

      {/* DAO Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Active Votes</p>
              <p className="text-gray-900 mt-1">{activeDisputes.length}</p>
            </div>
            <Vote className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Resolved</p>
              <p className="text-gray-900 mt-1">{resolvedDisputes.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Participation Rate</p>
              <p className="text-gray-900 mt-1">
                {disputes.length > 0 
                  ? Math.round((disputes.reduce((sum, d) => sum + d.votes.totalVoters, 0) / disputes.length))
                  : 0}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">DAO Members</p>
              <p className="text-gray-900 mt-1">247</p>
            </div>
            <Users className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Create Dispute Form */}
      {showCreateDispute && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-gray-900 mb-4">Raise New Dispute</h3>
          <form onSubmit={handleCreateDispute} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">Dispute Title</label>
                <input
                  type="text"
                  required
                  value={disputeForm.title}
                  onChange={(e) => setDisputeForm({ ...disputeForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of the issue"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Dispute Type</label>
                <select
                  required
                  value={disputeForm.type}
                  onChange={(e) => setDisputeForm({ ...disputeForm, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Type</option>
                  <option value="contract_violation">Contract Violation</option>
                  <option value="quality_issue">Quality Issue</option>
                  <option value="payment_dispute">Payment Dispute</option>
                  <option value="timeline_delay">Timeline Delay</option>
                  <option value="fraud_allegation">Fraud Allegation</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Related Tender/Contract</label>
                <select
                  required
                  value={disputeForm.relatedId}
                  onChange={(e) => setDisputeForm({ ...disputeForm, relatedId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Tender/Contract</option>
                  {tenders.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>{c.tenderTitle} (Contract)</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Detailed Description</label>
              <textarea
                required
                value={disputeForm.description}
                onChange={(e) => setDisputeForm({ ...disputeForm, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Provide detailed information about the dispute..."
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Evidence/Documentation</label>
              <textarea
                required
                value={disputeForm.evidence}
                onChange={(e) => setDisputeForm({ ...disputeForm, evidence: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Links, documents, or evidence supporting the dispute..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Shield className="w-5 h-5" />
                Submit to DAO
              </button>
              <button
                type="button"
                onClick={() => setShowCreateDispute(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Disputes */}
      <div className="space-y-4">
        <h3 className="text-gray-900">Active Voting</h3>
        {activeDisputes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <Vote className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No active disputes requiring votes</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeDisputes.map((dispute) => {
              const daysRemaining = Math.ceil(
                (new Date(dispute.votingDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              const hasVoted = userVotes[dispute.id];
              const approvalRate = dispute.votes.totalVoters > 0 
                ? ((dispute.votes.approve / dispute.votes.totalVoters) * 100).toFixed(1)
                : 0;

              return (
                <div key={dispute.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-gray-900">{dispute.title}</h4>
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                          {dispute.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-3">{dispute.description}</p>

                      <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <p className="text-gray-700 mb-2">Evidence:</p>
                        <p className="text-gray-600">{dispute.evidence}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-gray-500">Total Votes</p>
                          <p className="text-gray-900">{dispute.votes.totalVoters}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Approval Rate</p>
                          <p className="text-gray-900">{approvalRate}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Time Remaining</p>
                          <p className="text-gray-900">{daysRemaining} days</p>
                        </div>
                      </div>

                      {/* Voting Progress */}
                      <div className="space-y-2 mb-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-green-600">Approve</span>
                            <span className="text-gray-700">{dispute.votes.approve} votes</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${approvalRate}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-red-600">Reject</span>
                            <span className="text-gray-700">{dispute.votes.reject} votes</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-600 h-2 rounded-full transition-all"
                              style={{ width: `${100 - Number(approvalRate)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {/* Vote Buttons */}
                      {!hasVoted ? (
                        <div className="flex gap-3">
                          <button
                            onClick={() => castVote(dispute.id, 'approve')}
                            className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Vote Approve
                          </button>
                          <button
                            onClick={() => castVote(dispute.id, 'reject')}
                            className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <XCircle className="w-5 h-5" />
                            Vote Reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-blue-600">
                          <CheckCircle className="w-5 h-5" />
                          <span>You voted: {hasVoted}</span>
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

      {/* Resolved Disputes */}
      {resolvedDisputes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-gray-900">Resolved Disputes</h3>
          <div className="space-y-3">
            {resolvedDisputes.map((dispute) => (
              <div key={dispute.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-gray-900">{dispute.title}</h4>
                      <span className={`px-3 py-1 rounded-full ${
                        dispute.resolution.decision === 'approved' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {dispute.resolution.decision}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-gray-600">
                      <div>
                        <p className="text-gray-500">Total Votes</p>
                        <p>{dispute.votes.totalVoters}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Approval Rate</p>
                        <p>{dispute.resolution.approvalRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Resolved</p>
                        <p>{new Date(dispute.resolution.resolvedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DAO Info */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <Users className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-purple-900 mb-2">Decentralized Autonomous Organization (DAO)</h4>
            <p className="text-purple-800">
              All disputes are resolved through transparent, decentralized voting by DAO members. 
              Decisions require 60% approval rate with minimum 10 votes. All votes are recorded 
              immutably on the blockchain, ensuring fair and transparent dispute resolution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
