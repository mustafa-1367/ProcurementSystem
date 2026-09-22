import { useState } from 'react';
import { Users, Vote, CheckCircle, XCircle, TrendingUp, Shield, AlertCircle, FileText, Image, Video, X, ExternalLink, Clock } from 'lucide-react';
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
  userRole: string;
  reports: any[];
  onAwardTokens?: (amount: number, type: string, label: string, meta?: Record<string, unknown>) => void;
}

const DAO_VOTE_REWARD = 15;

export function DAOGovernance({
  disputes,
  setDisputes,
  tenders,
  contracts,
  setBlockchainRecords,
  blockchainRecords,
  userRole,
  reports,
  onAwardTokens,
}: DAOGovernanceProps) {
  const [userVotes, setUserVotes] = useState<{ [key: string]: 'approve' | 'reject' }>({});
  const [showHowItWorks, setShowHowItWorks] = useState(() => {
    try { return localStorage.getItem('dao-how-it-works-dismissed') !== 'true'; } catch { return true; }
  });
  const [daoFilter, setDaoFilter] = useState<'active' | 'resolved' | 'expired'>('active');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'objection' | 'whistleblower'>('all');
  const [expandedVoteHistory, setExpandedVoteHistory] = useState<Set<string>>(new Set());
  const [pendingVote, setPendingVote] = useState<{ disputeId: string; vote: 'approve' | 'reject' } | null>(null);
  const { t } = useTranslation();
  const { connected, isCorrectNetwork, connect, account } = useWeb3();
  const QUORUM_THRESHOLD = 5;

  // Roles allowed to vote
  const canVote = userRole === 'auditor' || userRole === 'oversight';

  const isDeadlinePassed = (dispute: any) => {
    if (!dispute.votingDeadline) return false;
    return new Date(dispute.votingDeadline).getTime() <= Date.now();
  };

  const castVote = async (disputeId: string, vote: 'approve' | 'reject') => {
    if (!canVote) return;

    const voteKey = account ? `${account}-${disputeId}` : disputeId;
    if (userVotes[voteKey]) return;

    const dispute = disputes.find((d) => d.id === disputeId);
    if (!dispute) return;
    if (isDeadlinePassed(dispute)) return;

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
      voter: account || 'anonymous',
      timestamp: new Date().toISOString(),
      verified: voteOnChain,
      simulated: !voteOnChain,
      onChain: voteOnChain,
    }]);

    setUserVotes({ ...userVotes, [voteKey]: vote });
    onAwardTokens?.(DAO_VOTE_REWARD, 'dao_vote_reward', t('wallet.voteRewardType'), { disputeId });

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

  // Categorise disputes
  const filterBySource = (d: any) => {
    if (sourceFilter === 'all') return true;
    if (sourceFilter === 'objection') return d.type === 'escalated_objection';
    if (sourceFilter === 'whistleblower') return d.type === 'escalated_whistleblower';
    return true;
  };

  const activeDisputes = disputes.filter((d) => d.status === 'voting' && d.votes && !isDeadlinePassed(d) && filterBySource(d));
  const expiredDisputes = disputes.filter((d) => d.status === 'voting' && d.votes && isDeadlinePassed(d) && filterBySource(d));
  const resolvedDisputes = disputes.filter((d) => d.status === 'resolved' && d.resolution && typeof d.resolution === 'object' && filterBySource(d));

  // Unique voters from blockchain records
  const uniqueVoters = new Set(
    blockchainRecords.filter(r => r.type === 'dao_vote' && r.voter).map(r => r.voter)
  );

  // Vote history for a dispute
  const getVoteHistory = (disputeId: string) =>
    blockchainRecords.filter(r => r.type === 'dao_vote' && r.disputeId === disputeId);

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

  // Total disputes with votes
  const allVotingDisputes = disputes.filter(d => d.votes);
  const avgVotersPerDispute = allVotingDisputes.length > 0
    ? Math.round(allVotingDisputes.reduce((sum, d) => sum + (d.votes?.totalVoters || 0), 0) / allVotingDisputes.length)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0b0b0b' }}>{t('dao.title')}</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6e6c66' }}>{t('dao.subtitle')}</p>
      </div>

      {/* DAO Mode Indicator */}
      {connected && isCorrectNetwork ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 16 }}>
          <Shield style={{ width: 20, height: 20, color: '#059669', flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#065f46' }}>{t('dao.onChainNotice')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#047857' }}>{t('dao.onChainDesc')}</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 16 }}>
          <Shield style={{ width: 20, height: 20, color: '#d97706', flexShrink: 0 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#92400e' }}>{t('dao.simulationNotice')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#b45309' }}>{t('dao.simulationDesc')}</p>
          </div>
        </div>
      )}

      {/* DAO Statistics — fixed #2 (members) and #6 (participation label) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
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
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#7c3aed' }}>{t('dao.avgVotersPerDispute')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 800, color: '#1e3a5f' }}>{avgVotersPerDispute}</p>
          </div>
        </div>

        <div style={{ background: '#fefce8', borderRadius: 12, border: '1px solid #fde68a', padding: '20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users style={{ width: 20, height: 20, color: '#ca8a04' }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#ca8a04' }}>{t('dao.uniqueVoters')}</p>
            <p style={{ margin: '2px 0 0', fontSize: 24, fontWeight: 800, color: '#1e3a5f' }}>{uniqueVoters.size || (connected ? 1 : 0)}</p>
          </div>
        </div>
      </div>

      {/* How it works info — dismissible */}
      {showHowItWorks && (
      <div style={{
        background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '16px 20px',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <AlertCircle style={{ width: 18, height: 18, color: '#0284c7', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.6, flex: 1 }}>
          <strong>{t('dao.howItWorks')}</strong> {t('dao.howItWorksDesc')}
        </div>
        <button
          onClick={() => { setShowHowItWorks(false); try { localStorage.setItem('dao-how-it-works-dismissed', 'true'); } catch {} }}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, flexShrink: 0 }}
          aria-label="Dismiss"
        >
          <X style={{ width: 16, height: 16, color: '#0284c7' }} />
        </button>
      </div>
      )}

      {/* Filter Tabs — #8 */}
      <div style={{ display: 'flex', gap: 4 }}>
        {([
          { key: 'active' as const, label: t('dao.tabActive'), count: activeDisputes.length },
          { key: 'resolved' as const, label: t('dao.tabResolved'), count: resolvedDisputes.length },
          { key: 'expired' as const, label: t('dao.tabExpired'), count: expiredDisputes.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setDaoFilter(tab.key)}
            style={{
              padding: '6px 14px', borderRadius: 999, border: '1px solid',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
              ...(daoFilter === tab.key
                ? { background: '#0f2942', color: '#fff', borderColor: '#0f2942' }
                : { background: '#fff', color: '#6e6c66', borderColor: '#e1e0d9' }),
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {([
          { key: 'all' as const, label: t('dao.allSources') },
          { key: 'objection' as const, label: t('dao.fromObjection') },
          { key: 'whistleblower' as const, label: t('dao.fromWhistleblower') },
        ]).map(sf => (
          <button
            key={sf.key}
            onClick={() => setSourceFilter(sf.key)}
            style={{
              padding: '4px 12px', borderRadius: 999, border: '1px solid',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
              ...(sourceFilter === sf.key
                ? { background: '#e0e7ff', color: '#3730a3', borderColor: '#c7d2fe' }
                : { background: '#fff', color: '#9ca3af', borderColor: '#e5e7eb' }),
            }}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {/* Active Disputes for Voting */}
      {daoFilter === 'active' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#0b0b0b' }}>{t('dao.activeVoting')}</h3>
        {activeDisputes.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(11,11,11,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 48, textAlign: 'center' }}>
            <Vote style={{ width: 64, height: 64, color: '#d1d5db', margin: '0 auto 16px' }} />
            <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>{t('dao.noActiveDisputes')}</p>
            <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{t('dao.noActiveDisputesHint')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activeDisputes.map((dispute) => {
              const daysRemaining = Math.ceil(
                (new Date(dispute.votingDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              const voteKey = account ? `${account}-${dispute.id}` : dispute.id;
              const hasVoted = userVotes[voteKey];
              const approvalRate = dispute.votes.totalVoters > 0
                ? ((dispute.votes.approve / dispute.votes.totalVoters) * 100).toFixed(1)
                : 0;
              const voteHistory = getVoteHistory(dispute.id);
              const srcStyle = getSourceStyle(dispute);

              return (
                <div key={dispute.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(11,11,11,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '24px' }}>
                  <div style={{ marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: '#0b0b0b', lineHeight: 1.4 }}>{dispute.title}</h4>
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
                      <p style={{ fontSize: 13.5, margin: '0 0 10px', color: '#6b7280' }}>{dispute.description}</p>

                      {/* Source link */}
                      {(dispute.sourceDisputeId || dispute.sourceReportId) && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#0f2942', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '4px 10px', marginBottom: 10 }}>
                          <ExternalLink style={{ width: 12, height: 12 }} />
                          {t('dao.sourceCase')}: {dispute.sourceDisputeId || dispute.sourceReportId}
                        </div>
                      )}

                      {/* Evidence */}
                      {(dispute.evidence || (dispute.attachments && dispute.attachments.length > 0)) && (
                        <div style={{ background: '#f9fafb', padding: 16, borderRadius: 10, marginBottom: 16 }}>
                          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{t('dao.evidence')}</p>
                          {dispute.evidence && <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280' }}>{dispute.evidence}</p>}
                          {dispute.attachments && dispute.attachments.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                              {dispute.attachments.map((file: any, i: number) => (
                                <a key={i} href={file.url} target="_blank" rel="noopener noreferrer"
                                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', textDecoration: 'none' }}>
                                  {file.type.startsWith('image/') ? <Image style={{ width: 16, height: 16, color: '#059669' }} /> :
                                   file.type.startsWith('video/') ? <Video style={{ width: 16, height: 16, color: '#7c3aed' }} /> :
                                   <FileText style={{ width: 16, height: 16, color: '#dc2626' }} />}
                                  <span style={{ fontSize: 13, color: '#2563eb', textDecoration: 'underline' }}>{file.name}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{t('dao.totalVotes')}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: '#0b0b0b' }}>{dispute.votes.totalVoters}</p>
                        </div>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{t('dao.approvalRate')}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: '#0b0b0b' }}>{approvalRate}%</p>
                        </div>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{t('dao.quorum')}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: dispute.votes.totalVoters >= QUORUM_THRESHOLD ? '#059669' : '#d97706' }}>
                            {dispute.votes.totalVoters}/{QUORUM_THRESHOLD}
                          </p>
                        </div>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{t('dao.timeRemaining')}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: daysRemaining <= 1 ? '#dc2626' : '#0b0b0b' }}>{daysRemaining} {t('dao.days')}</p>
                            <button
                              onClick={() => {
                                const updated = disputes.map(d =>
                                  d.id === dispute.id ? { ...d, votingDeadline: new Date(Date.now() - 1000).toISOString() } : d
                                );
                                setDisputes(updated);
                              }}
                              style={{
                                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                                border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280',
                                cursor: 'pointer', whiteSpace: 'nowrap',
                              }}
                              title={t('dao.skipToDeadlineHint')}
                            >
                              <Clock style={{ width: 10, height: 10, display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
                              {t('dao.skipToDeadline')}
                            </button>
                          </div>
                        </div>
                      </div>

                      {dispute.votes.totalVoters < QUORUM_THRESHOLD && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 16px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                          <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                          {t('dao.quorumNotMet')}
                        </div>
                      )}

                      {/* Voting Progress */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{t('dao.approve')}</span>
                            <span style={{ fontSize: 13, color: '#374151' }}>{dispute.votes.approve} {t('dao.votes')}</span>
                          </div>
                          <div style={{ width: '100%', background: '#e5e7eb', borderRadius: 999, height: 8 }}>
                            <div style={{ background: '#059669', height: 8, borderRadius: 999, transition: 'width 0.3s', width: `${approvalRate}%` }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>{t('dao.reject')}</span>
                            <span style={{ fontSize: 13, color: '#374151' }}>{dispute.votes.reject} {t('dao.votes')}</span>
                          </div>
                          <div style={{ width: '100%', background: '#e5e7eb', borderRadius: 999, height: 8 }}>
                            <div style={{ background: '#dc2626', height: 8, borderRadius: 999, transition: 'width 0.3s', width: `${dispute.votes.totalVoters > 0 ? ((dispute.votes.reject / dispute.votes.totalVoters) * 100).toFixed(1) : 0}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Vote Buttons — #1: role-gated */}
                      {!canVote ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', padding: '8px 16px', borderRadius: 10, fontSize: 13 }}>
                          <Shield style={{ width: 16, height: 16 }} />
                          {t('dao.onlyAuditorOversight')}
                        </div>
                      ) : !connected || !isCorrectNetwork ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 16px', borderRadius: 10, fontSize: 13 }}>
                            <Shield style={{ width: 16, height: 16 }} />
                            {t('dao.walletRequiredToVote')}
                          </div>
                          {!connected && (
                            <button onClick={connect} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#2563eb', color: '#fff', padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                              {t('dao.connectToVote')}
                            </button>
                          )}
                        </div>
                      ) : !hasVoted ? (
                        <>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button onClick={() => setPendingVote({ disputeId: dispute.id, vote: 'approve' })} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10,
                            border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                            background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff',
                            boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
                          }}>
                            <CheckCircle style={{ width: 18, height: 18 }} />
                            {t('dao.voteApprove')}
                          </button>
                          <button onClick={() => setPendingVote({ disputeId: dispute.id, vote: 'reject' })} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10,
                            border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                            background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff',
                            boxShadow: '0 2px 6px rgba(220,38,38,0.3)',
                          }}>
                            <XCircle style={{ width: 18, height: 18 }} />
                            {t('dao.voteReject')}
                          </button>
                        </div>
                        {pendingVote?.disputeId === dispute.id && (
                          <div style={{
                            marginTop: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
                            padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <AlertCircle style={{ width: 18, height: 18, color: '#d97706', flexShrink: 0 }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                                {pendingVote.vote === 'approve' ? t('dao.confirmVoteApprove') : t('dao.confirmVoteReject')}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => setPendingVote(null)}
                                style={{
                                  padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb',
                                  background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                }}
                              >
                                {t('dao.cancel')}
                              </button>
                              <button
                                onClick={() => { castVote(pendingVote.disputeId, pendingVote.vote); setPendingVote(null); }}
                                style={{
                                  padding: '6px 14px', borderRadius: 8, border: 'none',
                                  background: pendingVote.vote === 'approve' ? '#059669' : '#dc2626',
                                  color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                }}
                              >
                                {t('dao.confirmVote')}
                              </button>
                            </div>
                          </div>
                        )}
                        </>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb', fontSize: 14, fontWeight: 600 }}>
                          <CheckCircle style={{ width: 18, height: 18 }} />
                          <span>{t('dao.youVoted')} {hasVoted}</span>
                        </div>
                      )}

                      {/* Vote History — #3 */}
                      {voteHistory.length > 0 && (
                        <div style={{ marginTop: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
                          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#52514e' }}>{t('dao.voteHistory')} ({voteHistory.length})</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {(expandedVoteHistory.has(dispute.id) ? voteHistory : voteHistory.slice(-5)).map((v: any, i: number) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {v.vote === 'approve'
                                    ? <CheckCircle style={{ width: 12, height: 12, color: '#059669' }} />
                                    : <XCircle style={{ width: 12, height: 12, color: '#dc2626' }} />}
                                  <span style={{ fontFamily: 'ui-monospace, monospace', color: '#6b7280' }}>
                                    {v.voter ? `${v.voter.slice(0, 6)}...${v.voter.slice(-4)}` : 'Anonymous'}
                                  </span>
                                  <span style={{ fontWeight: 600, color: v.vote === 'approve' ? '#059669' : '#dc2626' }}>{v.vote}</span>
                                </div>
                                <span style={{ color: '#9ca3af' }}>{new Date(v.timestamp).toLocaleString()}</span>
                              </div>
                            ))}
                            {voteHistory.length > 5 && (
                              <button
                                onClick={() => {
                                  const next = new Set(expandedVoteHistory);
                                  if (next.has(dispute.id)) next.delete(dispute.id); else next.add(dispute.id);
                                  setExpandedVoteHistory(next);
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#2563eb', padding: '4px 0 0', textAlign: 'left' }}
                              >
                                {expandedVoteHistory.has(dispute.id) ? t('dao.showLess') : `${t('dao.showMore')} (${voteHistory.length})`}
                              </button>
                            )}
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
      )}

      {/* Resolved Disputes */}
      {daoFilter === 'resolved' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#0b0b0b' }}>{t('dao.resolvedDisputes')}</h3>
          {resolvedDisputes.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(11,11,11,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 48, textAlign: 'center' }}>
              <CheckCircle style={{ width: 64, height: 64, color: '#d1d5db', margin: '0 auto 16px' }} />
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>{t('dao.noResolvedYet')}</p>
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {resolvedDisputes.map((dispute) => {
              const srcStyle = getSourceStyle(dispute);
              const voteHistory = getVoteHistory(dispute.id);
              return (
                <div key={dispute.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(11,11,11,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '20px 20px 16px' }}>
                  <div>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: '#0b0b0b', lineHeight: 1.4 }}>{dispute.title}</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: '11.5px', fontWeight: 700, padding: '3px 10px',
                          borderRadius: 999, border: `1px solid ${srcStyle.borderColor}`,
                          color: srcStyle.color, background: srcStyle.background,
                        }}>
                          {getSourceLabel(dispute)}
                        </span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center',
                          fontSize: '11.5px', fontWeight: 700, padding: '3px 10px',
                          borderRadius: 999,
                          color: dispute.resolution.decision === 'approved' ? '#065f46' : '#991b1b',
                          background: dispute.resolution.decision === 'approved' ? '#dcfce7' : '#fee2e2',
                          border: `1px solid ${dispute.resolution.decision === 'approved' ? '#86efac' : '#fca5a5'}`,
                        }}>
                          {dispute.resolution.decision}
                        </span>
                        {blockchainRecords.some(r => r.disputeId === dispute.id && r.onChain) ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>● On-Chain</span>
                        ) : blockchainRecords.some(r => r.disputeId === dispute.id) ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: 999, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d' }}>● Simulated</span>
                        ) : null}
                      </div>
                      {(dispute.sourceDisputeId || dispute.sourceReportId) && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#0f2942', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '4px 10px', marginBottom: 8 }}>
                          <ExternalLink style={{ width: 12, height: 12 }} />
                          {t('dao.sourceCase')}: {dispute.sourceDisputeId || dispute.sourceReportId}
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{t('dao.totalVotes')}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: '#0b0b0b' }}>{dispute.votes.totalVoters}</p>
                        </div>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{t('dao.approvalRate')}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: '#0b0b0b' }}>{dispute.resolution?.approvalRate?.toFixed(1) || 0}%</p>
                        </div>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{t('dao.resolved')}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: '#0b0b0b' }}>{dispute.resolution?.resolvedAt ? new Date(dispute.resolution.resolvedAt).toLocaleDateString() : '—'}</p>
                        </div>
                        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{t('dao.followUp')}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: dispute.flaggedForReReview ? '#059669' : '#6b7280' }}>
                            {dispute.flaggedForReReview ? t('dao.flaggedForReReview') : t('dao.noFollowUp')}
                          </p>
                        </div>
                      </div>

                      {dispute.resolution?.summary && (
                        <div style={{ marginTop: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 4 }}>{t('dao.resolutionSummary')}</p>
                          <p style={{ margin: 0, fontSize: 13, color: '#166534', lineHeight: 1.5 }}>{dispute.resolution.summary}</p>
                        </div>
                      )}

                      {/* Vote History on resolved cards too */}
                      {voteHistory.length > 0 && (
                        <div style={{ marginTop: 10, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
                          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#52514e' }}>{t('dao.voteHistory')} ({voteHistory.length})</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {(expandedVoteHistory.has(dispute.id) ? voteHistory : voteHistory.slice(-5)).map((v: any, i: number) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {v.vote === 'approve'
                                    ? <CheckCircle style={{ width: 12, height: 12, color: '#059669' }} />
                                    : <XCircle style={{ width: 12, height: 12, color: '#dc2626' }} />}
                                  <span style={{ fontFamily: 'ui-monospace, monospace', color: '#6b7280' }}>
                                    {v.voter ? `${v.voter.slice(0, 6)}...${v.voter.slice(-4)}` : 'Anonymous'}
                                  </span>
                                  <span style={{ fontWeight: 600, color: v.vote === 'approve' ? '#059669' : '#dc2626' }}>{v.vote}</span>
                                </div>
                                <span style={{ color: '#9ca3af' }}>{new Date(v.timestamp).toLocaleString()}</span>
                              </div>
                            ))}
                            {voteHistory.length > 5 && (
                              <button
                                onClick={() => {
                                  const next = new Set(expandedVoteHistory);
                                  if (next.has(dispute.id)) next.delete(dispute.id); else next.add(dispute.id);
                                  setExpandedVoteHistory(next);
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#2563eb', padding: '4px 0 0', textAlign: 'left' }}
                              >
                                {expandedVoteHistory.has(dispute.id) ? t('dao.showLess') : `${t('dao.showMore')} (${voteHistory.length})`}
                              </button>
                            )}
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
      )}

      {/* Expired Disputes — #5 */}
      {daoFilter === 'expired' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#0b0b0b' }}>{t('dao.expiredDisputes')}</h3>
          {expiredDisputes.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(11,11,11,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 48, textAlign: 'center' }}>
              <Clock style={{ width: 64, height: 64, color: '#d1d5db', margin: '0 auto 16px' }} />
              <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>{t('dao.noExpiredYet')}</p>
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {expiredDisputes.map((dispute) => {
              const srcStyle = getSourceStyle(dispute);
              return (
                <div key={dispute.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(11,11,11,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '20px 20px 16px', opacity: 0.85 }}>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: '#0b0b0b', lineHeight: 1.4 }}>{dispute.title}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: '11.5px', fontWeight: 700, padding: '3px 10px',
                        borderRadius: 999, border: `1px solid ${srcStyle.borderColor}`,
                        color: srcStyle.color, background: srcStyle.background,
                      }}>
                        {getSourceLabel(dispute)}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: 999, color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                        <Clock style={{ width: 11, height: 11 }} /> {t('dao.expired')}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px' }}>{dispute.description}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{t('dao.totalVotes')}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700, color: '#0b0b0b' }}>{dispute.votes.totalVoters}</p>
                      </div>
                      <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{t('dao.quorum')}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
                          {dispute.votes.totalVoters}/{QUORUM_THRESHOLD} — {t('dao.quorumNotReached')}
                        </p>
                      </div>
                      <div style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{t('dao.deadline')}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{new Date(dispute.votingDeadline).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {canVote && (
                      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => {
                            const updated = disputes.map(d =>
                              d.id === dispute.id ? { ...d, votingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), votes: { approve: 0, reject: 0, totalVoters: 0 } } : d
                            );
                            setDisputes(updated);
                          }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
                            padding: '8px 16px', borderRadius: 8, border: '1px solid #c7d2fe',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff',
                            cursor: 'pointer', boxShadow: '0 1px 3px rgba(79,70,229,0.3)',
                          }}
                        >
                          <Vote style={{ width: 14, height: 14 }} />
                          {t('dao.reopenVoting')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* DAO Info */}
      <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <Users style={{ width: 24, height: 24, color: '#7c3aed', flexShrink: 0, marginTop: 2 }} />
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#581c87' }}>{t('dao.daoTitle')}</h4>
            <p style={{ margin: 0, fontSize: 14, color: '#6b21a8', lineHeight: 1.6 }}>{t('dao.daoDescription')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
