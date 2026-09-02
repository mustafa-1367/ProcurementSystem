import { useState } from 'react';
import { Users, Vote, CheckCircle, XCircle, TrendingUp, Shield, AlertCircle, FileText, Image, Video } from 'lucide-react';
import { addProcurementRecordAsync } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';
import { useWeb3 } from '../utils/useWeb3';

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
  blockchainRecords,
}: DAOGovernanceProps) {
  const [userVotes, setUserVotes] = useState<{ [key: string]: 'approve' | 'reject' }>({});
  const { t } = useTranslation();
  const { connected, isCorrectNetwork, connect, account } = useWeb3();
  const QUORUM_THRESHOLD = 5;

  const castVote = async (disputeId: string, vote: 'approve' | 'reject') => {
    const voteKey = account ? `${account}-${disputeId}` : disputeId;
    if (userVotes[voteKey]) return;

    const dispute = disputes.find((d) => d.id === disputeId);
    if (!dispute) return;

    const { block: voteBlock, contract: voteContract, onChain: voteOnChain } = await addProcurementRecordAsync('dao_resolution', {
      disputeId,
      approve: vote === 'approve',
    });

    setBlockchainRecords([...blockchainRecords, {
      id: voteBlock.hash,
      type: 'dao_vote',
      disputeId,
      contractId: voteContract.id,
      transactionHash: voteContract.transactionHash,
      vote,
      timestamp: new Date().toISOString(),
      verified: voteOnChain,
      simulated: !voteOnChain,
      onChain: voteOnChain,
    }]);

    setUserVotes({ ...userVotes, [voteKey]: vote });

    const newVotes = {
      approve: dispute.votes.approve + (vote === 'approve' ? 1 : 0),
      reject: dispute.votes.reject + (vote === 'reject' ? 1 : 0),
      totalVoters: dispute.votes.totalVoters + 1,
    };

    let status = dispute.status;
    let resolution = dispute.resolution;
    let routingDecision = dispute.routingDecision || null;
    let flaggedForReReview = dispute.flaggedForReReview || false;

    if (newVotes.totalVoters >= QUORUM_THRESHOLD) {
      const approvalRate = (newVotes.approve / newVotes.totalVoters) * 100;
      status = 'resolved';
      resolution = {
        decision: approvalRate >= 60 ? 'approved' : 'rejected',
        approvalRate,
        resolvedAt: new Date().toISOString(),
      };

      if (approvalRate >= 60) {
        routingDecision = 'oversight_review';
        flaggedForReReview = true;
      }
    }

    const updatedDisputes = disputes.map((d) =>
      d.id === disputeId ? { ...d, votes: newVotes, status, resolution, routingDecision, flaggedForReReview } : d
    );

    setDisputes(updatedDisputes);
  };

  const activeDisputes = disputes.filter((d) => d.status === 'voting' && d.votes);
  const resolvedDisputes = disputes.filter((d) => d.status === 'resolved' && d.resolution);

  // Identify source of escalation
  const getSourceLabel = (dispute: any) => {
    if (dispute.type === 'escalated_objection') return t('dao.fromObjection');
    if (dispute.type === 'escalated_whistleblower') return t('dao.fromWhistleblower');
    return t('dao.escalatedCase');
  };

  const getSourceStyle = (dispute: any) => {
    if (dispute.type === 'escalated_objection') return { color: '#1c5cab', background: '#eef5fd', borderColor: '#bcd6f5' };
    if (dispute.type === 'escalated_whistleblower') return { color: '#b91c1c', background: '#fef2f2', borderColor: '#fecaca' };
    return { color: '#7c3aed', background: '#f3eefe', borderColor: '#ddd6fe' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-gray-900">{t('dao.title')}</h2>
        <p className="text-gray-600 mt-1">{t('dao.subtitle')}</p>
      </div>

      {/* DAO Mode Indicator */}
      {connected && isCorrectNetwork ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <Shield className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-green-900 font-medium text-sm">{t('dao.onChainNotice')}</p>
            <p className="text-green-700 text-xs mt-0.5">{t('dao.onChainDesc')}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <Shield className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-amber-900 font-medium text-sm">{t('dao.simulationNotice')}</p>
            <p className="text-amber-700 text-xs mt-0.5">{t('dao.simulationDesc')}</p>
          </div>
        </div>
      )}

      {/* DAO Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <div style={{ background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', padding: '20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Vote style={{ width: 20, height: 20, color: '#2563eb' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#2563eb' }}>{t('dao.activeVotes')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 800, color: '#1e3a5f' }}>{activeDisputes.length}</p>
          </div>
        </div>

        <div style={{ background: '#ecfdf5', borderRadius: 12, border: '1px solid #a7f3d0', padding: '20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle style={{ width: 20, height: 20, color: '#059669' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#059669' }}>{t('dao.resolved')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 800, color: '#1e3a5f' }}>{resolvedDisputes.length}</p>
          </div>
        </div>

        <div style={{ background: '#faf5ff', borderRadius: 12, border: '1px solid #e9d5ff', padding: '20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingUp style={{ width: 20, height: 20, color: '#7c3aed' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#7c3aed' }}>{t('dao.participationRate')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 800, color: '#1e3a5f' }}>
              {disputes.length > 0
                ? Math.round((disputes.reduce((sum, d) => sum + (d.votes?.totalVoters || 0), 0) / disputes.length))
                : 0}
            </p>
          </div>
        </div>

        <div style={{ background: '#fefce8', borderRadius: 12, border: '1px solid #fde68a', padding: '20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users style={{ width: 20, height: 20, color: '#ca8a04' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#ca8a04' }}>{t('dao.daoMembers')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: '#1e3a5f' }}>{connected && isCorrectNetwork ? '1 (You)' : 'Connect Wallet'}</p>
          </div>
        </div>
      </div>

      {/* How it works info */}
      <div style={{
        background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '16px 20px',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <AlertCircle style={{ width: 18, height: 18, color: '#0284c7', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.6 }}>
          <strong>{t('dao.howItWorks')}</strong> {t('dao.howItWorksDesc')}
        </div>
      </div>

      {/* Active Disputes for Voting */}
      <div className="space-y-4">
        <h3 className="text-gray-900">{t('dao.activeVoting')}</h3>
        {activeDisputes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <Vote className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('dao.noActiveDisputes')}</p>
            <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{t('dao.noActiveDisputesHint')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeDisputes.map((dispute) => {
              const daysRemaining = Math.ceil(
                (new Date(dispute.votingDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              const voteKey = account ? `${account}-${dispute.id}` : dispute.id;
              const hasVoted = userVotes[voteKey];
              const approvalRate = dispute.votes.totalVoters > 0
                ? ((dispute.votes.approve / dispute.votes.totalVoters) * 100).toFixed(1)
                : 0;

              const srcStyle = getSourceStyle(dispute);

              return (
                <div key={dispute.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2" style={{ flexWrap: 'wrap' }}>
                        <h4 className="text-gray-900">{dispute.title}</h4>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: '11.5px', fontWeight: 700, padding: '3px 10px',
                          borderRadius: 999, border: `1px solid ${srcStyle.borderColor}`,
                          color: srcStyle.color, background: srcStyle.background,
                        }}>
                          {getSourceLabel(dispute)}
                        </span>
                        {blockchainRecords.some(r => r.disputeId === dispute.id && r.onChain) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>● On-Chain</span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3">{dispute.description}</p>

                      {/* Evidence */}
                      {(dispute.evidence || (dispute.attachments && dispute.attachments.length > 0)) && (
                        <div className="bg-gray-50 p-4 rounded-lg mb-4">
                          <p className="text-gray-700 mb-2">{t('dao.evidence')}</p>
                          {dispute.evidence && <p className="text-gray-600 mb-2">{dispute.evidence}</p>}
                          {dispute.attachments && dispute.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-3 mt-2">
                              {dispute.attachments.map((file: any, i: number) => (
                                <a key={i} href={file.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors">
                                  {file.type.startsWith('image/') ? <Image className="w-4 h-4 text-green-600" /> :
                                   file.type.startsWith('video/') ? <Video className="w-4 h-4 text-purple-600" /> :
                                   <FileText className="w-4 h-4 text-red-600" />}
                                  <span className="text-sm text-blue-600 underline">{file.name}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-gray-500">{t('dao.totalVotes')}</p>
                          <p className="text-gray-900">{dispute.votes.totalVoters}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('dao.approvalRate')}</p>
                          <p className="text-gray-900">{approvalRate}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('dao.quorum')}</p>
                          <p className={dispute.votes.totalVoters >= QUORUM_THRESHOLD ? 'text-green-700' : 'text-amber-600'}>
                            {dispute.votes.totalVoters}/{QUORUM_THRESHOLD} {t('dao.quorumRequired')}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('dao.timeRemaining')}</p>
                          <p className="text-gray-900">{daysRemaining} {t('dao.days')}</p>
                        </div>
                      </div>

                      {dispute.votes.totalVoters < QUORUM_THRESHOLD && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4 text-sm text-amber-800">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          {t('dao.quorumNotMet')}
                        </div>
                      )}

                      {/* Voting Progress */}
                      <div className="space-y-2 mb-4">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-green-600">{t('dao.approve')}</span>
                            <span className="text-gray-700">{dispute.votes.approve} {t('dao.votes')}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-600 h-2 rounded-full transition-all" style={{ width: `${approvalRate}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-red-600">{t('dao.reject')}</span>
                            <span className="text-gray-700">{dispute.votes.reject} {t('dao.votes')}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-red-600 h-2 rounded-full transition-all" style={{ width: `${100 - Number(approvalRate)}%` }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Vote Buttons */}
                      {!connected || !isCorrectNetwork ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg text-sm">
                            <Shield className="w-4 h-4" />
                            {t('dao.walletRequiredToVote')}
                          </div>
                          {!connected && (
                            <button onClick={connect} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">
                              {t('dao.connectToVote')}
                            </button>
                          )}
                        </div>
                      ) : !hasVoted ? (
                        <div className="flex gap-3">
                          <button onClick={() => castVote(dispute.id, 'approve')} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
                            <CheckCircle className="w-5 h-5" />
                            {t('dao.voteApprove')}
                          </button>
                          <button onClick={() => castVote(dispute.id, 'reject')} className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors">
                            <XCircle className="w-5 h-5" />
                            {t('dao.voteReject')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-blue-600">
                          <CheckCircle className="w-5 h-5" />
                          <span>{t('dao.youVoted')} {hasVoted}</span>
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
          <h3 className="text-gray-900">{t('dao.resolvedDisputes')}</h3>
          <div className="space-y-3">
            {resolvedDisputes.map((dispute) => {
              const srcStyle = getSourceStyle(dispute);
              return (
                <div key={dispute.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2" style={{ flexWrap: 'wrap' }}>
                        <h4 className="text-gray-900">{dispute.title}</h4>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: '11.5px', fontWeight: 700, padding: '3px 10px',
                          borderRadius: 999, border: `1px solid ${srcStyle.borderColor}`,
                          color: srcStyle.color, background: srcStyle.background,
                        }}>
                          {getSourceLabel(dispute)}
                        </span>
                        <span className={`px-3 py-1 rounded-full ${
                          dispute.resolution.decision === 'approved'
                            ? 'bg-green-100 text-green-900'
                            : 'bg-red-100 text-red-900'
                        }`}>
                          {dispute.resolution.decision}
                        </span>
                        {blockchainRecords.some(r => r.disputeId === dispute.id && r.onChain) ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>● On-Chain</span>
                        ) : blockchainRecords.some(r => r.disputeId === dispute.id) ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d' }}>● Simulated</span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-gray-600">
                        <div>
                          <p className="text-gray-500">{t('dao.totalVotes')}</p>
                          <p>{dispute.votes.totalVoters}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('dao.approvalRate')}</p>
                          <p>{dispute.resolution?.approvalRate?.toFixed(1) || 0}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('dao.resolved')}</p>
                          <p>{new Date(dispute.resolution.resolvedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAO Info */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <Users className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-purple-900 mb-2">{t('dao.daoTitle')}</h4>
            <p className="text-purple-800">
              {t('dao.daoDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
