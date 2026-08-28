import { useState } from 'react';
import { AlertTriangle, Shield, Eye, EyeOff, Lock, Send, CheckCircle, Clock, MessageSquare, Upload, X, FileText, Image, Video, Coins } from 'lucide-react';
import { addProcurementRecordAsync, blockchain } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';

interface WhistleblowerPortalProps {
  reports: any[];
  setReports: (reports: any[]) => void;
  tenders: any[];
  contracts: any[];
  disputes: any[];
  setDisputes: (disputes: any[]) => void;
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
}

export function WhistleblowerPortal({
  reports,
  setReports,
  tenders,
  contracts,
  disputes,
  setDisputes,
  setBlockchainRecords,
  blockchainRecords,
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
    reporterType: '',
    routedTo: '',
  });
  const [zkProof, setZkProof] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [referralOpen, setReferralOpen] = useState<string | null>(null);
  const [referralTarget, setReferralTarget] = useState('');
  const { t } = useTranslation();

  const ROUTING_AUTHORITIES = [
    { value: 'sao', label: t('whistleblower.routeSAO') },
    { value: 'major_crimes', label: t('whistleblower.routeMajorCrimes') },
    { value: 'national_inspector', label: t('whistleblower.routeNationalInspector') },
    { value: 'ago', label: t('whistleblower.routeAGO') },
    { value: 'ministry_interior', label: t('whistleblower.routeMinistryInterior') },
  ];

  const getAuthorityLabel = (value: string) => {
    const all: Record<string, string> = {
      sao: t('whistleblower.routeSAO'),
      major_crimes: t('whistleblower.routeMajorCrimes'),
      national_inspector: t('whistleblower.routeNationalInspector'),
      ago: t('whistleblower.routeAGO'),
      ministry_interior: t('whistleblower.routeMinistryInterior'),
      directorate_contract_oversight: t('whistleblower.routeContractOversight'),
      debarment_committee_npa: t('whistleblower.routeDebarmentNPA'),
    };
    return all[value] || value;
  };

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
    // ⚠️ SIMULATED — Not a real Zero-Knowledge Proof. In production, this would use
    // a ZKP library (e.g., snarkjs, circom) with proper cryptographic circuits.
    const proof = `SIM-ZKP-${Math.random().toString(36).substr(2, 16).toUpperCase()}`;
    setZkProof(proof);
    return proof;
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();

    const proof = generateZKProof();
    
    const severityRewards: Record<string, number> = { low: 100, medium: 250, high: 500, critical: 1000 };
    const rewardAmount = severityRewards[reportForm.severity] || 100;

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
        status: 'pending_investigation',
      },
      referrals: [] as { authority: string; referredAt: string; blockchainRecordId: string }[],
    };

    // Add to blockchain with ZK proof
    const { block, contract, onChain } = await addProcurementRecordAsync('whistleblower_report', {
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
      verified: onChain,
      simulated: !onChain,
      onChain,
    };

    // Reward is NOT awarded immediately — it will be released after investigation is completed.

    setReports([...reports, newReport]);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setShowReportForm(false);
    setUploadedFiles([]);
    setReportForm({
      title: '',
      category: '',
      severity: '',
      relatedId: '',
      description: '',
      evidence: '',
      contactMethod: '',
      reporterType: '',
      routedTo: '',
    });
  };

  const handleReferReport = async (reportId: string, authority: string) => {
    const { block, contract, onChain } = await addProcurementRecordAsync('whistleblower_referral', {
      reportId,
      referredTo: authority,
      timestamp: Date.now(),
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'whistleblower_referral',
      reportId,
      referredTo: authority,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
    };

    const updatedReports = reports.map((r) =>
      r.id === reportId
        ? {
            ...r,
            referrals: [
              ...(r.referrals || []),
              { authority, referredAt: new Date().toISOString(), blockchainRecordId: block.hash },
            ],
          }
        : r
    );

    setReports(updatedReports);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setReferralOpen(null);
    setReferralTarget('');
  };

  const handleEscalateToDAO = async (report: any) => {
    const newComplaint = {
      id: `CMP-${Date.now()}`,
      title: `Escalated: ${report.title}`,
      description: report.description,
      relatedId: report.relatedId || '',
      level: 'central_npa',
      evidence: report.evidence || '',
      type: 'oversight_complaint',
      status: 'under_review',
      sourceReportId: report.id,
      committeeMembers: [],
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
      sourceReportId: report.id,
      title: newComplaint.title,
      escalated: true,
    });

    setBlockchainRecords([...blockchainRecords, {
      id: block.hash,
      type: 'whistleblower_escalation',
      reportId: report.id,
      disputeId: newComplaint.id,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
    }]);

    setDisputes([...disputes, newComplaint]);

    // Mark report as escalated
    setReports(reports.map((r) =>
      r.id === report.id ? { ...r, escalatedToDAO: true, escalatedComplaintId: newComplaint.id } : r
    ));
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

  const whistleblowerReports = reports.filter((r) => r.type !== 'evaluation_report');
  const pendingReports = whistleblowerReports.filter((r) => r.investigationStatus === 'pending');
  const underInvestigation = whistleblowerReports.filter((r) => r.investigationStatus === 'investigating');
  const resolvedReports = whistleblowerReports.filter((r) => r.investigationStatus === 'resolved');

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

      {/* Protection Features */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-8 h-8 opacity-100" />
            <Lock className="w-6 h-6 opacity-60" />
          </div>
          <p className="opacity-100">{t('whistleblower.zkpProtection')}</p>
          <p className="mt-1 text-sm opacity-80">{t('whistleblower.zkpSimulated')}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 opacity-100" />
          </div>
          <p className="opacity-100">{t('whistleblower.totalReports')}</p>
          <p className="mt-1">{whistleblowerReports.length}</p>
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

              <div>
                <label className="block text-gray-700 mb-2">{t('whistleblower.reporterType')}</label>
                <select
                  required
                  value={reportForm.reporterType}
                  onChange={(e) => {
                    const type = e.target.value;
                    let routedTo = '';
                    if (type === 'citizen') routedTo = 'directorate_contract_oversight';
                    if (type === 'company_supplier') routedTo = 'debarment_committee_npa';
                    setReportForm({ ...reportForm, reporterType: type, routedTo });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">{t('whistleblower.selectReporterType')}</option>
                  <option value="government_employee">{t('whistleblower.governmentEmployee')}</option>
                  <option value="citizen">{t('whistleblower.citizenReporter')}</option>
                  <option value="company_supplier">{t('whistleblower.companySupplier')}</option>
                </select>
              </div>

              {reportForm.reporterType === 'government_employee' && (
                <div>
                  <label className="block text-gray-700 mb-2">{t('whistleblower.routeTo')}</label>
                  <select
                    required
                    value={reportForm.routedTo}
                    onChange={(e) => setReportForm({ ...reportForm, routedTo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">{t('whistleblower.selectAuthority')}</option>
                    {ROUTING_AUTHORITIES.map((auth) => (
                      <option key={auth.value} value={auth.value}>{auth.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {(reportForm.reporterType === 'citizen' || reportForm.reporterType === 'company_supplier') && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    {t('whistleblower.autoRouted')}: <strong>{getAuthorityLabel(reportForm.routedTo)}</strong>
                  </span>
                </div>
              )}
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
        
        {whistleblowerReports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('whistleblower.noReports')}</p>
            <p className="text-gray-500 mt-2">{t('whistleblower.reportsProtected')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {whistleblowerReports.map((report) => {
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
                        {blockchainRecords.some(r => r.reportId === report.id && r.onChain) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7' }}>● On-Chain</span>
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

                      {/* Routing Info */}
                      {report.routedTo && (
                        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 mb-3">
                          <Shield className="w-4 h-4 text-indigo-600" />
                          <span className="text-sm text-indigo-800">
                            {t('whistleblower.routedTo')}: <strong>{getAuthorityLabel(report.routedTo)}</strong>
                          </span>
                          {report.reporterType && (
                            <span className="text-xs text-indigo-600 ml-2">
                              ({report.reporterType === 'government_employee' ? t('whistleblower.governmentEmployee') : report.reporterType === 'citizen' ? t('whistleblower.citizenReporter') : t('whistleblower.companySupplier')})
                            </span>
                          )}
                        </div>
                      )}

                      {report.rewards?.eligible && (
                        <div className={`${report.rewards.status === 'awarded' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'} border rounded-lg p-3 flex items-center justify-between mb-3`}>
                          <div className="flex items-center gap-2">
                            <Coins className={`w-4 h-4 ${report.rewards.status === 'awarded' ? 'text-green-600' : 'text-amber-600'}`} />
                            <p className={report.rewards.status === 'awarded' ? 'text-green-800' : 'text-amber-800'}>
                              {report.rewards.status === 'awarded'
                                ? `${t('whistleblower.rewardReceived')} (${report.rewards.amount} TOK)`
                                : t('whistleblower.rewardPendingInvestigation')}
                            </p>
                          </div>
                          {report.rewards.status === 'awarded' && report.rewards.amount > 0 && (
                            <span className="text-green-700 font-bold">+{report.rewards.amount} TOK</span>
                          )}
                        </div>
                      )}

                      {/* Referral System & Escalation */}
                      <div className="flex items-center gap-3 mb-3">
                        <button
                          onClick={() => setReferralOpen(referralOpen === report.id ? null : report.id)}
                          className="flex items-center gap-2 text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {t('whistleblower.referToAuthority')}
                        </button>
                        {!report.escalatedToDAO ? (
                          <button
                            onClick={() => handleEscalateToDAO(report)}
                            className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {t('whistleblower.escalateToDAO')}
                          </button>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            {t('whistleblower.escalatedToDAO')}
                          </span>
                        )}
                      </div>

                      {referralOpen === report.id && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 flex items-center gap-3">
                          <select
                            value={referralTarget}
                            onChange={(e) => setReferralTarget(e.target.value)}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          >
                            <option value="">{t('whistleblower.selectAuthority')}</option>
                            {ROUTING_AUTHORITIES.map((auth) => (
                              <option key={auth.value} value={auth.value}>{auth.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => referralTarget && handleReferReport(report.id, referralTarget)}
                            disabled={!referralTarget}
                            className="flex items-center gap-1.5 text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {t('whistleblower.referToAuthority')}
                          </button>
                        </div>
                      )}

                      {/* Referral History */}
                      {report.referrals && report.referrals.length > 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-sm font-semibold text-gray-700 mb-2">{t('whistleblower.referralHistory')}</p>
                          <div className="space-y-1.5">
                            {report.referrals.map((ref: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Send className="w-3 h-3 text-gray-500" />
                                  <span className="text-gray-700">{getAuthorityLabel(ref.authority)}</span>
                                </div>
                                <span className="text-gray-500 text-xs">{new Date(ref.referredAt).toLocaleDateString()}</span>
                              </div>
                            ))}
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
