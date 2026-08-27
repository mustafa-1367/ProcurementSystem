import { useState, useRef } from 'react';
import { Users, Vote, AlertCircle, CheckCircle, XCircle, MessageSquare, TrendingUp, Shield, Upload, FileText, Image, Video, X } from 'lucide-react';
import { addProcurementRecord } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

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
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; type: string; size: number; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userVotes, setUserVotes] = useState<{ [key: string]: 'approve' | 'reject' }>({});
  const { t } = useTranslation();

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

  const handleCreateDispute = (e: React.FormEvent) => {
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
    setUploadedFiles([]);
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
              <p className="text-gray-600">{t('dao.daoMembers')}</p>
              <p className="text-gray-900 mt-1">247</p>
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
                        <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full">
                          {dispute.type.replace(/_/g, ' ')}
                        </span>
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

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-gray-500">{t('dao.totalVotes')}</p>
                          <p className="text-gray-900">{dispute.votes.totalVoters}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('dao.approvalRate')}</p>
                          <p className="text-gray-900">{approvalRate}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('dao.timeRemaining')}</p>
                          <p className="text-gray-900">{daysRemaining} {t('dao.days')}</p>
                        </div>
                      </div>

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
                      {!hasVoted ? (
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
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-gray-600">
                      <div>
                        <p className="text-gray-500">{t('dao.totalVotes')}</p>
                        <p>{dispute.votes.totalVoters}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{t('dao.approvalRate')}</p>
                        <p>{dispute.resolution.approvalRate.toFixed(1)}%</p>
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
    </div>
  );
}
