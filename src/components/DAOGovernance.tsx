import { useState, useRef } from 'react';
import { Users, Vote, AlertCircle, CheckCircle, XCircle, MessageSquare, TrendingUp, Shield, Upload, FileText, Image, Video, X, Scale } from 'lucide-react';
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
  reports: any[];
  setReports: (reports: any[]) => void;
}

export function DAOGovernance({
  disputes,
  setDisputes,
  tenders,
  contracts,
  setBlockchainRecords,
  blockchainRecords,
  reports,
  setReports,
}: DAOGovernanceProps) {
  const [showCreateDispute, setShowCreateDispute] = useState(false);
  const [disputeForm, setDisputeForm] = useState({
    title: '',
    description: '',
    relatedId: '',
    type: '',
    evidence: '',
  });
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; type: string; size: number; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userVotes, setUserVotes] = useState<{ [key: string]: 'approve' | 'reject' }>({});
  const [activePanel, setActivePanel] = useState<'disputes' | 'oversight'>('disputes');
  const [committeeMembers, setCommitteeMembers] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState('');
  const [complaintForm, setComplaintForm] = useState<{
    title: string; description: string; relatedId: string; level: string; evidence: string; sourceReportId?: string;
  }>({
    title: '',
    description: '',
    relatedId: '',
    level: '',
    evidence: '',
    sourceReportId: '',
  });
  const { t } = useTranslation();
  const { connected, isCorrectNetwork, connect, account } = useWeb3();
  const QUORUM_THRESHOLD = 5;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
    }));

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-5 h-5 text-green-600" />;
    if (type.startsWith('video/')) return <Video className="w-5 h-5 text-purple-600" />;
    if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-600" />;
    return <FileText className="w-5 h-5 text-gray-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();

    const newDispute = {
      id: `DSP-${Date.now()}`,
      ...disputeForm,
      attachments: uploadedFiles.map((f) => ({ name: f.name, type: f.type, size: f.size, url: f.url })),
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
    const { block, contract, success, onChain } = await addProcurementRecordAsync('dispute', {
      disputeId: newDispute.id,
      title: disputeForm.title,
      type: disputeForm.type,
    });

    // Store the on-chain dispute ID if available
    if (contract.data?.onChainDisputeId) {
      newDispute.onChainDisputeId = contract.data.onChainDisputeId;
    }

    const blockchainRecord = {
      id: block.hash,
      type: 'dispute_created',
      disputeId: newDispute.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
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
    setUploadedFiles([]);
  };

  const castVote = async (disputeId: string, vote: 'approve' | 'reject') => {
    // Prevent double voting: key by wallet address + dispute ID
    const voteKey = account ? `${account}-${disputeId}` : disputeId;
    if (userVotes[voteKey]) return; // Already voted

    const dispute = disputes.find((d) => d.id === disputeId);
    if (!dispute) return;

    // Attempt on-chain vote via smart contract
    const { block: voteBlock, contract: voteContract, onChain: voteOnChain } = await addProcurementRecordAsync('dao_resolution', {
      disputeId,
      approve: vote === 'approve',
    });

    // Record the vote in blockchain records
    const voteRecord = {
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
    };
    setBlockchainRecords([...blockchainRecords, voteRecord]);

    setUserVotes({ ...userVotes, [voteKey]: vote });

    const newVotes = {
      approve: dispute.votes.approve + (vote === 'approve' ? 1 : 0),
      reject: dispute.votes.reject + (vote === 'reject' ? 1 : 0),
      totalVoters: dispute.votes.totalVoters + 1,
    };

    let status = dispute.status;
    let resolution = dispute.resolution;

    // Auto-resolve only if quorum is met (on-chain contract auto-resolves at 10 votes)
    if (newVotes.totalVoters >= QUORUM_THRESHOLD) {
      const approvalRate = (newVotes.approve / newVotes.totalVoters) * 100;
      status = 'resolved';
      resolution = {
        decision: approvalRate >= 60 ? 'approved' : 'rejected',
        approvalRate,
        resolvedAt: new Date().toISOString(),
      };
    }

    const updatedDisputes = disputes.map((d) =>
      d.id === disputeId ? { ...d, votes: newVotes, status, resolution } : d
    );

    setDisputes(updatedDisputes);
  };

  // Filter whistleblower reports for linking
  const whistleblowerReports = reports.filter((r: any) => r.type !== 'evaluation_report');

  // Oversight complaint handlers
  const oversightComplaints = disputes.filter((d) => d.type === 'oversight_complaint');
  const validComplaints = oversightComplaints.filter((d) => d.routingDecision === 'evaluation_committee');
  const invalidComplaints = oversightComplaints.filter((d) => d.routingDecision === 'dismissed');

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (committeeMembers.length < 3) return;

    const newComplaint = {
      id: `CMP-${Date.now()}`,
      ...complaintForm,
      type: 'oversight_complaint',
      status: 'under_review',
      committeeMembers,
      reviewedBy: [],
      routingDecision: null,
      flaggedForReReview: false,
      createdAt: new Date().toISOString(),
      votes: { approve: 0, reject: 0, totalVoters: 0 },
      votingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      resolution: null,
    };

    const { block, contract, onChain } = await addProcurementRecordAsync('dispute_complaint', {
      complaintId: newComplaint.id,
      title: complaintForm.title,
      level: complaintForm.level,
      sourceReportId: complaintForm.sourceReportId || null,
    });

    setBlockchainRecords([...blockchainRecords, {
      id: block.hash,
      type: 'oversight_complaint',
      disputeId: newComplaint.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
    }]);

    setDisputes([...disputes, newComplaint]);
    setComplaintForm({ title: '', description: '', relatedId: '', level: '', evidence: '', sourceReportId: '' });
  };

  const handleMarkComplaint = async (complaintId: string, valid: boolean) => {
    const updated = disputes.map((d) =>
      d.id === complaintId
        ? {
            ...d,
            routingDecision: valid ? 'evaluation_committee' : 'dismissed',
            flaggedForReReview: valid,
            status: valid ? 'routed' : 'dismissed',
          }
        : d
    );
    setDisputes(updated);

    if (valid) {
      const { block, contract, onChain } = await addProcurementRecordAsync('dispute_complaint', {
        complaintId,
        action: 'routed_to_evaluation_committee',
      });

      setBlockchainRecords([...blockchainRecords, {
        id: block.hash,
        type: 'complaint_routed',
        disputeId: complaintId,
        contractId: contract.id,
        transactionHash: contract.transactionHash,
        routedTo: 'evaluation_committee',
        timestamp: new Date().toISOString(),
        verified: onChain,
        simulated: !onChain,
        onChain,
      }]);
    }
  };

  const activeDisputes = disputes.filter((d) => d.status === 'voting' && d.votes);
  const resolvedDisputes = disputes.filter((d) => d.status === 'resolved' && d.resolution);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">{t('dao.title')}</h2>
          <p className="text-gray-600 mt-1">{t('dao.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreateDispute(!showCreateDispute)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <AlertCircle className="w-5 h-5" />
          {t('dao.raiseDispute')}
        </button>
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

      {/* Panel Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActivePanel('disputes')}
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: '13.5px', fontWeight: 700,
            background: activePanel === 'disputes' ? '#0f2942' : '#f3f4f6',
            color: activePanel === 'disputes' ? '#fff' : '#374151',
            border: activePanel === 'disputes' ? 'none' : '1px solid #d1d5db',
            cursor: 'pointer',
          }}
        >
          {t('dao.disputeVoting')}
        </button>
        <button
          onClick={() => setActivePanel('oversight')}
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: '13.5px', fontWeight: 700,
            background: activePanel === 'oversight' ? '#0f2942' : '#f3f4f6',
            color: activePanel === 'oversight' ? '#fff' : '#374151',
            border: activePanel === 'oversight' ? 'none' : '1px solid #d1d5db',
            cursor: 'pointer',
          }}
        >
          {t('dao.contractOversight')}
        </button>
      </div>

      {/* ===== CONTRACT IMPLEMENTATION OVERSIGHT PANEL ===== */}
      {activePanel === 'oversight' && (
        <div className="space-y-6">
          {/* Committee Members */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-gray-900 mb-1 font-semibold">{t('dao.oversightPanel')}</h3>
            <p className="text-gray-600 text-sm mb-4">{t('dao.oversightDesc')}</p>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-medium mb-2">{t('dao.committeeMembers')}</label>
              <div className="flex gap-2 mb-3" style={{ maxWidth: 480 }}>
                <input
                  type="text"
                  value={memberInput}
                  onChange={(e) => setMemberInput(e.target.value)}
                  placeholder={t('dao.memberPlaceholder')}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && memberInput.trim()) {
                      e.preventDefault();
                      setCommitteeMembers([...committeeMembers, memberInput.trim()]);
                      setMemberInput('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (memberInput.trim()) {
                      setCommitteeMembers([...committeeMembers, memberInput.trim()]);
                      setMemberInput('');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  {t('dao.addMember')}
                </button>
              </div>
              {committeeMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {committeeMembers.map((m, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-sm">
                      <Users className="w-3 h-3" />
                      {m}
                      <button onClick={() => setCommitteeMembers(committeeMembers.filter((_, idx) => idx !== i))} className="text-blue-500 hover:text-blue-700">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {committeeMembers.length < 3 ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" style={{ maxWidth: 480 }}>
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span className="text-amber-700 text-xs font-medium">{committeeMembers.length}/3 — {t('dao.minimumMembers')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2" style={{ maxWidth: 480 }}>
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-green-700 text-xs font-medium">{committeeMembers.length}/3 — Committee ready to process complaints</span>
                </div>
              )}
            </div>
          </div>

          {/* Oversight Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg shadow-sm p-5 border border-blue-200 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-blue-600 text-xs font-medium">{t('dao.complaintsCount')}</p>
                <p className="text-blue-900 text-2xl font-bold">{oversightComplaints.length}</p>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg shadow-sm p-5 border border-green-200 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-green-600 text-xs font-medium">{t('dao.validComplaints')}</p>
                <p className="text-green-900 text-2xl font-bold">{validComplaints.length}</p>
              </div>
            </div>
            <div className="bg-red-50 rounded-lg shadow-sm p-5 border border-red-200 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-red-600 text-xs font-medium">{t('dao.invalidComplaints')}</p>
                <p className="text-red-900 text-2xl font-bold">{invalidComplaints.length}</p>
              </div>
            </div>
          </div>

          {/* Submit Complaint Form */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-gray-900 mb-4 font-semibold">{t('dao.submitComplaint')}</h3>
            <form onSubmit={handleSubmitComplaint} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 text-sm mb-2">{t('dao.complaintTitle')}</label>
                  <input
                    type="text"
                    required
                    value={complaintForm.title}
                    onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('dao.complaintPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm mb-2">{t('dao.disputeLevel')}</label>
                  <select
                    required
                    value={complaintForm.level}
                    onChange={(e) => setComplaintForm({ ...complaintForm, level: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">{t('dao.selectLevel')}</option>
                    <option value="central_npa">{t('dao.centralNPA')}</option>
                    <option value="ministry_level">{t('dao.ministryLevel')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm mb-2">{t('dao.relatedTender')}</label>
                  <select
                    value={complaintForm.relatedId}
                    onChange={(e) => setComplaintForm({ ...complaintForm, relatedId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">{t('dao.selectTender')}</option>
                    {tenders.map((td) => (
                      <option key={td.id} value={td.id}>{td.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Related Whistleblower Report */}
              {whistleblowerReports.length > 0 && (
                <div>
                  <label className="block text-gray-700 text-sm mb-2">{t('dao.relatedReport')}</label>
                  <select
                    value={complaintForm.sourceReportId || ''}
                    onChange={(e) => {
                      const reportId = e.target.value;
                      const report = reports.find((r: any) => r.id === reportId);
                      setComplaintForm({
                        ...complaintForm,
                        sourceReportId: reportId,
                        ...(report && !complaintForm.title ? { title: `Escalated: ${report.title}`, description: report.description, evidence: report.evidence || '' } : {}),
                        ...(report?.relatedId && !complaintForm.relatedId ? { relatedId: report.relatedId } : {}),
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">{t('dao.selectReport')}</option>
                    {whistleblowerReports.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.title} ({r.category})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-gray-700 text-sm mb-2">{t('dao.complaintDescription')}</label>
                <textarea
                  required
                  value={complaintForm.description}
                  onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('dao.complaintDescPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">{t('dao.complaintEvidence')}</label>
                <textarea
                  value={complaintForm.evidence}
                  onChange={(e) => setComplaintForm({ ...complaintForm, evidence: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('dao.complaintEvidencePlaceholder')}
                />
              </div>
              <button
                type="submit"
                disabled={committeeMembers.length < 3}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Shield className="w-5 h-5" />
                {t('dao.submitComplaint')}
              </button>
            </form>
          </div>

          {/* Routing Dashboard */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,.06)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #0f2942, #1e4976)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Scale style={{ width: 18, height: 18, color: '#c99a3c' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f2942' }}>{t('dao.routingDashboard')}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{oversightComplaints.length} {oversightComplaints.length === 1 ? 'complaint' : 'complaints'}</p>
                </div>
              </div>
              {oversightComplaints.length > 0 && (
                <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ color: '#059669' }}>{oversightComplaints.filter(c => c.routingDecision === 'evaluation_committee').length} Valid</span>
                  <span style={{ color: '#dc2626' }}>{oversightComplaints.filter(c => c.routingDecision === 'dismissed').length} Dismissed</span>
                  <span style={{ color: '#d97706' }}>{oversightComplaints.filter(c => !c.routingDecision).length} Pending</span>
                </div>
              )}
            </div>

            {oversightComplaints.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <AlertCircle style={{ width: 26, height: 26, color: '#9ca3af' }} />
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#6b7280' }}>{t('dao.noComplaints')}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>Complaints will appear here once submitted</p>
              </div>
            ) : (
              <div style={{ padding: '12px 16px 16px' }}>
                {oversightComplaints.map((complaint, idx) => {
                  const isValid = complaint.routingDecision === 'evaluation_committee';
                  const isDismissed = complaint.routingDecision === 'dismissed';
                  const isPending = !complaint.routingDecision;
                  const borderColor = isValid ? '#059669' : isDismissed ? '#dc2626' : '#d97706';
                  const isOnChain = blockchainRecords.some(r => r.disputeId === complaint.id && r.onChain);

                  return (
                    <div
                      key={complaint.id}
                      style={{
                        position: 'relative',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        borderLeft: `4px solid ${borderColor}`,
                        padding: '14px 18px',
                        marginBottom: idx < oversightComplaints.length - 1 ? 10 : 0,
                        background: isPending ? '#fffbeb' : '#fff',
                        transition: 'box-shadow .15s, transform .15s',
                        cursor: 'default',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                    >
                      {/* Top row: title + badges | status */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f2942' }}>{complaint.title}</h4>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999,
                              background: complaint.level === 'central_npa' ? '#f3e8ff' : '#f0fdfa',
                              color: complaint.level === 'central_npa' ? '#7c3aed' : '#0d9488',
                            }}>
                              {complaint.level === 'central_npa' ? t('dao.centralNPA') : t('dao.ministryLevel')}
                            </span>
                            {isOnChain && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>On-Chain</span>
                            )}
                          </div>
                          {/* Description + metadata in compact row */}
                          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>{complaint.description}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>
                              {new Date(complaint.createdAt).toLocaleDateString()}
                            </span>
                            {complaint.evidence && (
                              <span style={{ fontSize: 12, color: '#6b7280' }}>
                                <span style={{ color: '#9ca3af' }}>{t('dao.complaintEvidence')}:</span> {complaint.evidence}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status / Actions */}
                        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          {isValid ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '8px 14px' }}>
                              <CheckCircle style={{ width: 18, height: 18, color: '#059669' }} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', lineHeight: 1.2 }}>{t('dao.complaintValid')}</div>
                              </div>
                            </div>
                          ) : isDismissed ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '8px 14px' }}>
                              <XCircle style={{ width: 18, height: 18, color: '#dc2626' }} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', lineHeight: 1.2 }}>{t('dao.complaintInvalid')}</div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => handleMarkComplaint(complaint.id, true)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                                  borderRadius: 8, border: '1.5px solid #059669', background: '#ecfdf5',
                                  color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                  transition: 'all .15s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.color = '#059669'; }}
                              >
                                <CheckCircle style={{ width: 14, height: 14 }} />
                                {t('dao.markValid')}
                              </button>
                              <button
                                onClick={() => handleMarkComplaint(complaint.id, false)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                                  borderRadius: 8, border: '1.5px solid #dc2626', background: '#fef2f2',
                                  color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                  transition: 'all .15s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
                              >
                                <XCircle style={{ width: 14, height: 14 }} />
                                {t('dao.markInvalid')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer: metadata chips */}
                      {(complaint.committeeMembers?.length > 0 || complaint.sourceReportId) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
                          {complaint.committeeMembers && complaint.committeeMembers.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Users style={{ width: 14, height: 14, color: '#6b7280' }} />
                              <span style={{ fontSize: 12, color: '#6b7280' }}>
                                {t('dao.committeeMembers')}: <span style={{ fontWeight: 600, color: '#374151' }}>{complaint.committeeMembers.join(', ')}</span>
                              </span>
                            </div>
                          )}
                          {complaint.sourceReportId && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <MessageSquare style={{ width: 14, height: 14, color: '#c99a3c' }} />
                              <span style={{ fontSize: 12, color: '#c99a3c', fontWeight: 600 }}>
                                {t('dao.linkedReport')}: {complaint.sourceReportId}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activePanel === 'disputes' && <>
      {/* DAO Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('dao.activeVotes')}</p>
              <p className="text-gray-900 mt-1">{activeDisputes.length}</p>
            </div>
            <Vote className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('dao.resolved')}</p>
              <p className="text-gray-900 mt-1">{resolvedDisputes.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('dao.participationRate')}</p>
              <p className="text-gray-900 mt-1">
                {disputes.length > 0
                  ? Math.round((disputes.reduce((sum, d) => sum + (d.votes?.totalVoters || 0), 0) / disputes.length))
                  : 0}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('dao.daoMembers')}</p>
              <p className="text-gray-900 mt-1">{connected && isCorrectNetwork ? '1 (You)' : 'Connect Wallet'}</p>
            </div>
            <Users className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Create Dispute Form */}
      {showCreateDispute && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-gray-900 mb-4">{t('dao.raiseNewDispute')}</h3>
          <form onSubmit={handleCreateDispute} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">{t('dao.disputeTitle')}</label>
                <input
                  type="text"
                  required
                  value={disputeForm.title}
                  onChange={(e) => setDisputeForm({ ...disputeForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('dao.titlePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">{t('dao.disputeType')}</label>
                <select
                  required
                  value={disputeForm.type}
                  onChange={(e) => setDisputeForm({ ...disputeForm, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('dao.selectType')}</option>
                  <option value="contract_violation">{t('dao.contractViolation')}</option>
                  <option value="quality_issue">{t('dao.qualityIssue')}</option>
                  <option value="payment_dispute">{t('dao.paymentDispute')}</option>
                  <option value="timeline_delay">{t('dao.timelineDelay')}</option>
                  <option value="fraud_allegation">{t('dao.fraudAllegation')}</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">{t('dao.relatedTender')}</label>
                <select
                  required
                  value={disputeForm.relatedId}
                  onChange={(e) => setDisputeForm({ ...disputeForm, relatedId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('dao.selectTender')}</option>
                  {tenders.map((td) => (
                    <option key={td.id} value={td.id}>{td.title}</option>
                  ))}
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>{c.tenderTitle} ({t('dao.contract')})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">{t('dao.detailedDescription')}</label>
              <textarea
                required
                value={disputeForm.description}
                onChange={(e) => setDisputeForm({ ...disputeForm, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('dao.descriptionPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2">{t('dao.evidenceDocumentation')}</label>
              <textarea
                value={disputeForm.evidence}
                onChange={(e) => setDisputeForm({ ...disputeForm, evidence: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('dao.evidencePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2">{t('dao.uploadEvidence')}</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*,video/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              >
                <Upload className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-700 font-medium">{t('dao.clickToUpload')}</p>
                <p className="text-gray-600 text-sm mt-1">
                  {t('dao.uploadHint')}
                </p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.type)}
                        <div>
                          <p className="text-gray-800 text-sm font-medium">{file.name}</p>
                          <p className="text-gray-600 text-xs">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      {file.type.startsWith('image/') && (
                        <img src={file.url} alt={file.name} className="w-12 h-12 object-cover rounded" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 ml-3"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Shield className="w-5 h-5" />
                {t('dao.submitToDAO')}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateDispute(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('dao.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Disputes */}
      <div className="space-y-4">
        <h3 className="text-gray-900">{t('dao.activeVoting')}</h3>
        {activeDisputes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <Vote className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('dao.noActiveDisputes')}</p>
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

              return (
                <div key={dispute.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-gray-900">{dispute.title}</h4>
                        <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full">
                          {dispute.type.replace(/_/g, ' ')}
                        </span>
                        {blockchainRecords.some(r => r.disputeId === dispute.id && r.onChain) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>● On-Chain</span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3">{dispute.description}</p>

                      <div className="bg-gray-50 p-4 rounded-lg mb-4">
                        <p className="text-gray-700 mb-2">{t('dao.evidence')}</p>
                        {dispute.evidence && <p className="text-gray-600 mb-2">{dispute.evidence}</p>}
                        {dispute.attachments && dispute.attachments.length > 0 && (
                          <div className="space-y-2 mt-2">
                            <p className="text-gray-500 text-sm">{t('dao.attachedFiles')}</p>
                            <div className="flex flex-wrap gap-3">
                              {dispute.attachments.map((file: any, i: number) => (
                                <a
                                  key={i}
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
                                >
                                  {file.type.startsWith('image/') ? (
                                    <Image className="w-4 h-4 text-green-600" />
                                  ) : file.type.startsWith('video/') ? (
                                    <Video className="w-4 h-4 text-purple-600" />
                                  ) : (
                                    <FileText className="w-4 h-4 text-red-600" />
                                  )}
                                  <span className="text-sm text-blue-600 underline">{file.name}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

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

                      {/* Quorum warning */}
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
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${approvalRate}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-red-600">{t('dao.reject')}</span>
                            <span className="text-gray-700">{dispute.votes.reject} {t('dao.votes')}</span>
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
                      {!connected || !isCorrectNetwork ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg text-sm">
                            <Shield className="w-4 h-4" />
                            {t('dao.walletRequiredToVote')}
                          </div>
                          {!connected && (
                            <button
                              onClick={connect}
                              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                            >
                              {t('dao.connectToVote')}
                            </button>
                          )}
                        </div>
                      ) : !hasVoted ? (
                        <div className="flex gap-3">
                          <button
                            onClick={() => castVote(dispute.id, 'approve')}
                            className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors focus:ring-2 focus:ring-green-400 focus:outline-none"
                          >
                            <CheckCircle className="w-5 h-5" />
                            {t('dao.voteApprove')}
                          </button>
                          <button
                            onClick={() => castVote(dispute.id, 'reject')}
                            className="flex items-center gap-2 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors focus:ring-2 focus:ring-red-400 focus:outline-none"
                          >
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
            {resolvedDisputes.map((dispute) => (
              <div key={dispute.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-gray-900">{dispute.title}</h4>
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
            ))}
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
      </>}
    </div>
  );
}
