import { useState } from 'react';
import { AlertTriangle, Shield, Eye, EyeOff, Lock, Send, CheckCircle, Clock, MessageSquare, Upload, X, FileText, Image, Video, Coins } from 'lucide-react';
import { addProcurementRecord, blockchain } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface WhistleblowerPortalProps {
  reports: any[];
  setReports: (reports: any[]) => void;
  tenders: any[];
  contracts: any[];
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
  walletBalance: number;
  setWalletBalance: (v: number) => void;
  walletTxs: any[];
  setWalletTxs: (txs: any[]) => void;
}

const SEVERITY_REWARDS: Record<string, number> = {
  low: 100,
  medium: 250,
  high: 500,
  critical: 1000,
};

export function WhistleblowerPortal({
  reports,
  setReports,
  tenders,
  contracts,
  setBlockchainRecords,
  blockchainRecords,
  walletBalance,
  setWalletBalance,
  walletTxs,
  setWalletTxs,
}: WhistleblowerPortalProps) {
  const [showReportForm, setShowReportForm] = useState(false);
  const [anonymousMode, setAnonymousMode] = useState(true);
  const [reportForm, setReportForm] = useState({
    title: '',
    category: '',
    severity: '',
    relatedId: '',
    description: '',
    evidence: '',
    contactMethod: '',
  });
  const [zkProof, setZkProof] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [rewardNotification, setRewardNotification] = useState<{ amount: number; severity: string } | null>(null);
  const { t } = useTranslation();

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type.startsWith('video/')) return Video;
    return FileText;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles([...uploadedFiles, ...Array.from(e.target.files)]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const generateZKProof = () => {
    // Simulate Zero-Knowledge Proof generation
    const proof = `ZKP-${Math.random().toString(36).substr(2, 16).toUpperCase()}`;
    setZkProof(proof);
    return proof;
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();

    const proof = generateZKProof();
    
    const rewardAmount = SEVERITY_REWARDS[reportForm.severity] || 100;

    const newReport = {
      id: `RPT-${Date.now()}`,
      ...reportForm,
      isAnonymous: anonymousMode,
      zkProof: proof,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      investigationStatus: 'pending',
      rewards: {
        eligible: true,
        amount: rewardAmount,
        status: 'awarded',
      },
    };

    // Add to blockchain with ZK proof
    const { block, contract } = addProcurementRecord('whistleblower_report', {
      reportId: newReport.id,
      zkProof: proof,
      category: reportForm.category,
      severity: reportForm.severity,
      anonymous: anonymousMode,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'whistleblower_report',
      reportId: newReport.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      zkProof: proof,
      timestamp: new Date().toISOString(),
      verified: true,
    };

    // Award TOK to wallet
    const rewardBlock = blockchain.addBlock({ type: 'whistleblower_reward', reportId: newReport.id, amount: rewardAmount, timestamp: Date.now() });
    setWalletBalance(walletBalance + rewardAmount);
    setWalletTxs([
      { id: rewardBlock.hash, type: 'reward', label: `Whistleblower reward (${reportForm.severity})`, amount: rewardAmount, timestamp: Date.now() },
      ...walletTxs,
    ]);

    setReports([...reports, newReport]);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setShowReportForm(false);
    setUploadedFiles([]);
    setRewardNotification({ amount: rewardAmount, severity: reportForm.severity });
    setTimeout(() => setRewardNotification(null), 5000);
    setReportForm({
      title: '',
      category: '',
      severity: '',
      relatedId: '',
      description: '',
      evidence: '',
      contactMethod: '',
    });
  };

  const categories = [
    { value: 'Fraud', label: t('whistleblower.fraud') },
    { value: 'Corruption', label: t('whistleblower.corruption') },
    { value: 'Bribery', label: t('whistleblower.bribery') },
    { value: 'Conflict of Interest', label: t('whistleblower.conflictOfInterest') },
    { value: 'Quality Violations', label: t('whistleblower.qualityViolations') },
    { value: 'Financial Misconduct', label: t('whistleblower.financialMisconduct') },
    { value: 'Contract Manipulation', label: t('whistleblower.contractManipulation') },
    { value: 'Unfair Bidding', label: t('whistleblower.unfairBidding') },
  ];

  const pendingReports = reports.filter((r) => r.investigationStatus === 'pending');
  const underInvestigation = reports.filter((r) => r.investigationStatus === 'investigating');
  const resolvedReports = reports.filter((r) => r.investigationStatus === 'resolved');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">{t('whistleblower.title')}</h2>
          <p className="text-gray-600 mt-1">{t('whistleblower.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowReportForm(!showReportForm)}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
        >
          <AlertTriangle className="w-5 h-5" />
          {t('whistleblower.submitReport')}
        </button>
      </div>

      {/* Reward Notification */}
      {rewardNotification && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4 flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Coins className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-green-900 font-semibold">{t('whistleblower.rewardAwarded')}</p>
            <p className="text-green-700 text-sm">
              {t('whistleblower.rewardForSeverity')} {rewardNotification.severity}
            </p>
          </div>
          <div className="text-green-800 font-bold text-lg">+{rewardNotification.amount} TOK</div>
        </div>
      )}

      {/* Protection Features */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-8 h-8 opacity-100" />
            <Lock className="w-6 h-6 opacity-60" />
          </div>
          <p className="opacity-100">{t('whistleblower.zkpProtection')}</p>
          <p className="mt-1">{t('whistleblower.guaranteedAnonymity')}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 opacity-100" />
          </div>
          <p className="opacity-100">{t('whistleblower.totalReports')}</p>
          <p className="mt-1">{reports.length}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 opacity-100" />
          </div>
          <p className="opacity-100">{t('whistleblower.underInvestigation')}</p>
          <p className="mt-1">{underInvestigation.length}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 opacity-100" />
          </div>
          <p className="opacity-100">{t('whistleblower.resolvedLabel')}</p>
          <p className="mt-1">{resolvedReports.length}</p>
        </div>
      </div>

      {/* Report Submission Form */}
      {showReportForm && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-gray-900">{t('whistleblower.submitWhistleblower')}</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAnonymousMode(!anonymousMode)}
                aria-pressed={anonymousMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none ${
                  anonymousMode
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                {anonymousMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {anonymousMode ? t('whistleblower.anonymousMode') : t('whistleblower.identifiedMode')}
              </button>
            </div>
          </div>

          {anonymousMode && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-purple-900">{t('whistleblower.zkpActive')}</p>
                  <p className="text-purple-700 mt-1">
                    {t('whistleblower.zkpDescription')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitReport} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">{t('whistleblower.reportTitle')}</label>
                <input
                  type="text"
                  required
                  value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder={t('whistleblower.titlePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">{t('whistleblower.categoryLabel')}</label>
                <select
                  required
                  value={reportForm.category}
                  onChange={(e) => setReportForm({ ...reportForm, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">{t('whistleblower.selectCategory')}</option>
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">{t('whistleblower.severityLevel')}</label>
                <select
                  required
                  value={reportForm.severity}
                  onChange={(e) => setReportForm({ ...reportForm, severity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">{t('whistleblower.selectSeverity')}</option>
                  <option value="low">{t('whistleblower.low')}</option>
                  <option value="medium">{t('whistleblower.medium')}</option>
                  <option value="high">{t('whistleblower.high')}</option>
                  <option value="critical">{t('whistleblower.critical')}</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">{t('whistleblower.relatedTender')}</label>
                <select
                  value={reportForm.relatedId}
                  onChange={(e) => setReportForm({ ...reportForm, relatedId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">{t('whistleblower.selectIfApplicable')}</option>
                  {tenders.map((td) => (
                    <option key={td.id} value={td.id}>{td.title}</option>
                  ))}
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>{c.tenderTitle} ({t('whistleblower.contract')})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">{t('whistleblower.detailedDescription')}</label>
              <textarea
                required
                value={reportForm.description}
                onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('whistleblower.descriptionPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2">{t('whistleblower.evidenceInfo')}</label>
              <textarea
                value={reportForm.evidence}
                onChange={(e) => setReportForm({ ...reportForm, evidence: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={t('whistleblower.evidencePlaceholder')}
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-gray-700 mb-2">{t('whistleblower.uploadEvidence')}</label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => document.getElementById('evidence-file-input')?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('evidence-file-input')?.click(); } }}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-orange-400 hover:bg-orange-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-700 font-medium">{t('whistleblower.dragOrClick')}</p>
                <p className="text-gray-500 text-sm mt-1">{t('whistleblower.acceptedFormats')}</p>
              </div>
              <input
                id="evidence-file-input"
                type="file"
                multiple
                accept="image/*,video/*,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file, idx) => {
                    const Icon = getFileIcon(file);
                    return (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-gray-600 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{file.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          aria-label={`${t('whistleblower.removeFile')} ${file.name}`}
                          className="p-1 rounded hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {!anonymousMode && (
              <div>
                <label className="block text-gray-700 mb-2">{t('whistleblower.secureContact')}</label>
                <input
                  type="text"
                  value={reportForm.contactMethod}
                  onChange={(e) => setReportForm({ ...reportForm, contactMethod: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder={t('whistleblower.contactPlaceholder')}
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Send className="w-5 h-5" />
                {t('whistleblower.submitSecurely')}
              </button>
              <button
                type="button"
                onClick={() => setShowReportForm(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('whistleblower.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        <h3 className="text-gray-900">{t('whistleblower.allReports')}</h3>
        
        {reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('whistleblower.noReports')}</p>
            <p className="text-gray-500 mt-2">{t('whistleblower.reportsProtected')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const severityColors = {
                low: 'bg-blue-100 text-blue-900',
                medium: 'bg-amber-100 text-amber-900',
                high: 'bg-orange-100 text-orange-900',
                critical: 'bg-red-100 text-red-900',
              };

              const statusColors = {
                pending: 'bg-gray-100 text-gray-900',
                investigating: 'bg-blue-100 text-blue-900',
                resolved: 'bg-green-100 text-green-900',
              };

              return (
                <div key={report.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-gray-900">{report.title}</h4>
                        <span className={`px-3 py-1 rounded-full ${severityColors[report.severity as keyof typeof severityColors]}`}>
                          {report.severity}
                        </span>
                        <span className={`px-3 py-1 rounded-full ${statusColors[report.investigationStatus as keyof typeof statusColors]}`}>
                          {report.investigationStatus}
                        </span>
                        {report.isAnonymous && (
                          <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-900 rounded-full">
                            <Shield className="w-4 h-4" />
                            {t('whistleblower.zkpProtection')}
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 mb-3">{report.description}</p>

                      <div className="grid grid-cols-3 gap-4 text-gray-700 mb-3">
                        <div>
                          <p className="text-gray-500">{t('whistleblower.category')}</p>
                          <p>{report.category}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('whistleblower.submitted')}</p>
                          <p>{new Date(report.submittedAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{t('whistleblower.zkProof')}</p>
                          <p className="font-mono text-sm">{report.zkProof}</p>
                        </div>
                      </div>

                      {report.evidence && (
                        <div className="bg-gray-50 p-4 rounded-lg mb-3">
                          <p className="text-gray-700 mb-1">{t('whistleblower.evidenceLabel')}</p>
                          <p className="text-gray-600">{report.evidence}</p>
                        </div>
                      )}

                      {report.rewards.eligible && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Coins className="w-4 h-4 text-green-600" />
                            <p className="text-green-800">
                              {report.rewards.status === 'awarded'
                                ? `${t('whistleblower.rewardReceived')} (${report.rewards.amount} TOK)`
                                : t('whistleblower.rewardEligible')}
                            </p>
                          </div>
                          {report.rewards.amount > 0 && (
                            <span className="text-green-700 font-bold">+{report.rewards.amount} TOK</span>
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

      {/* Protection Info */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <Shield className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-purple-900 mb-2">{t('whistleblower.protectionTitle')}</h4>
            <ul className="text-purple-800 space-y-1">
              <li>• {t('whistleblower.protectionZKP')}</li>
              <li>• {t('whistleblower.protectionBlockchain')}</li>
              <li>• {t('whistleblower.protectionIncentive')}</li>
              <li>• {t('whistleblower.protectionMultichannel')}</li>
              <li>• {t('whistleblower.protectionLegal')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
