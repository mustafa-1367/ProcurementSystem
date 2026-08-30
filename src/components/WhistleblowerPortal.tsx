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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: t('whistleblower.zkpProtection'), value: t('whistleblower.zkpSimulated'), icon: Shield, accent: '#7c3aed', bg: '#f5f3ff', iconBg: '#ede9fe', isText: true },
          { label: t('whistleblower.totalReports'), value: whistleblowerReports.length, icon: AlertTriangle, accent: '#dc2626', bg: '#fef2f2', iconBg: '#fee2e2' },
          { label: t('whistleblower.underInvestigation'), value: underInvestigation.length, icon: Clock, accent: '#d97706', bg: '#fffbeb', iconBg: '#fef3c7' },
          { label: t('whistleblower.resolvedLabel'), value: resolvedReports.length, icon: CheckCircle, accent: '#059669', bg: '#ecfdf5', iconBg: '#d1fae5' },
        ].map((card, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 12, padding: '14px 16px',
            border: '1px solid rgba(11,11,11,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, background: card.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <card.icon style={{ width: 18, height: 18, color: card.accent }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#9e9d99' }}>{card.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: (card as any).isText ? 12 : 20, fontWeight: 700, color: '#0b0b0b', letterSpacing: '-0.02em', lineHeight: 1.3 }}>{card.value}</p>
            </div>
          </div>
        ))}
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
                style={{ display: 'none' }}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare style={{ width: 16, height: 16, color: '#6e6c66' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0b0b0b' }}>{t('whistleblower.allReports')}</h3>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#f0f0ee', color: '#6e6c66' }}>{whistleblowerReports.length}</span>
        </div>

        {whistleblowerReports.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(11,11,11,0.08)', padding: '48px 24px', textAlign: 'center' }}>
            <AlertTriangle style={{ width: 48, height: 48, color: '#d1d0cc', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, color: '#6e6c66', margin: 0 }}>{t('whistleblower.noReports')}</p>
            <p style={{ fontSize: 13, color: '#9e9d99', margin: '6px 0 0' }}>{t('whistleblower.reportsProtected')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {whistleblowerReports.map((report) => {
              const severityStyle: Record<string, { bg: string; color: string; border: string }> = {
                low: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
                medium: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
                high: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
                critical: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
              };
              const statusStyle: Record<string, { bg: string; color: string; border: string }> = {
                pending: { bg: '#f4f4f5', color: '#52525b', border: '#e4e4e7' },
                investigating: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
                resolved: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
              };
              const sev = severityStyle[report.severity] || severityStyle.medium;
              const stat = statusStyle[report.investigationStatus] || statusStyle.pending;

              return (
                <div key={report.id} style={{
                  background: '#fff', borderRadius: 12, border: '1px solid rgba(11,11,11,0.08)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
                }}>
                  {/* Report Header */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(11,11,11,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0b0b0b' }}>{report.title}</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`, textTransform: 'capitalize' }}>
                          {report.severity}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: stat.bg, color: stat.color, border: `1px solid ${stat.border}`, textTransform: 'capitalize' }}>
                          {report.investigationStatus}
                        </span>
                        {report.isAnonymous && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Shield style={{ width: 10, height: 10 }} /> ZKP
                          </span>
                        )}
                        {blockchainRecords.some(r => r.reportId === report.id && r.onChain) && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            ● On-Chain
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: 13.5, color: '#52514e', lineHeight: 1.5 }}>{report.description}</p>
                  </div>

                  {/* Report Details */}
                  <div style={{ padding: '14px 20px' }}>
                    {/* Meta Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9e9d99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t('whistleblower.category')}</div>
                        <div style={{ fontSize: 13.5, color: '#0b0b0b', fontWeight: 500 }}>{report.category}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9e9d99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t('whistleblower.submitted')}</div>
                        <div style={{ fontSize: 13.5, color: '#0b0b0b', fontWeight: 500 }}>{new Date(report.submittedAt).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9e9d99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t('whistleblower.zkProof')}</div>
                        <div style={{ fontSize: 12, color: '#0b0b0b', fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}>{report.zkProof}</div>
                      </div>
                    </div>

                    {/* Evidence */}
                    {report.evidence && (
                      <div style={{ background: '#fafaf9', border: '1px solid rgba(11,11,11,0.06)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9e9d99', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{t('whistleblower.evidenceLabel')}</div>
                        <div style={{ fontSize: 13, color: '#52514e', lineHeight: 1.5 }}>{report.evidence}</div>
                      </div>
                    )}

                    {/* Routing Info */}
                    {report.routedTo && (
                      <div style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Shield style={{ width: 14, height: 14, color: '#7c3aed', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: '#5b21b6' }}>
                          {t('whistleblower.routedTo')}: <strong>{getAuthorityLabel(report.routedTo)}</strong>
                        </span>
                        {report.reporterType && (
                          <span style={{ fontSize: 11, color: '#7c3aed', marginLeft: 4 }}>
                            ({report.reporterType === 'government_employee' ? t('whistleblower.governmentEmployee') : report.reporterType === 'citizen' ? t('whistleblower.citizenReporter') : t('whistleblower.companySupplier')})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Reward Status */}
                    {report.rewards?.eligible && (
                      <div style={{
                        background: report.rewards.status === 'awarded' ? '#ecfdf5' : '#fffbeb',
                        border: `1px solid ${report.rewards.status === 'awarded' ? '#a7f3d0' : '#fde68a'}`,
                        borderRadius: 8, padding: '10px 14px', marginBottom: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Coins style={{ width: 14, height: 14, color: report.rewards.status === 'awarded' ? '#059669' : '#d97706' }} />
                          <span style={{ fontSize: 13, color: report.rewards.status === 'awarded' ? '#065f46' : '#92400e' }}>
                            {report.rewards.status === 'awarded'
                              ? `${t('whistleblower.rewardReceived')} (${report.rewards.amount} TOK)`
                              : t('whistleblower.rewardPendingInvestigation')}
                          </span>
                        </div>
                        {report.rewards.status === 'awarded' && report.rewards.amount > 0 && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>+{report.rewards.amount} TOK</span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <button
                        onClick={() => setReferralOpen(referralOpen === report.id ? null : report.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600,
                          color: '#52514e', background: '#f4f4f2', border: '1px solid #e1e0d9', borderRadius: 8,
                          padding: '6px 12px', cursor: 'pointer',
                        }}
                      >
                        <Send style={{ width: 12, height: 12 }} />
                        {t('whistleblower.referToAuthority')}
                      </button>
                      {!report.escalatedToDAO ? (
                        <button
                          onClick={() => handleEscalateToDAO(report)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600,
                            color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
                            padding: '6px 12px', cursor: 'pointer',
                          }}
                        >
                          <AlertTriangle style={{ width: 12, height: 12 }} />
                          {t('whistleblower.escalateToDAO')}
                        </button>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
                          padding: '4px 10px', borderRadius: 999, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
                        }}>
                          <CheckCircle style={{ width: 11, height: 11 }} />
                          {t('whistleblower.escalatedToDAO')}
                        </span>
                      )}
                    </div>

                    {/* Referral Dropdown */}
                    {referralOpen === report.id && (
                      <div style={{ background: '#fafaf9', border: '1px solid rgba(11,11,11,0.08)', borderRadius: 8, padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <select
                          value={referralTarget}
                          onChange={(e) => setReferralTarget(e.target.value)}
                          style={{ flex: 1, padding: '7px 10px', fontSize: 13, borderRadius: 8, border: '1px solid #e1e0d9', background: '#fff', color: '#0b0b0b', outline: 'none' }}
                        >
                          <option value="">{t('whistleblower.selectAuthority')}</option>
                          {ROUTING_AUTHORITIES.map((auth) => (
                            <option key={auth.value} value={auth.value}>{auth.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => referralTarget && handleReferReport(report.id, referralTarget)}
                          disabled={!referralTarget}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700,
                            color: '#fff', background: referralTarget ? '#0f2942' : '#9e9d99', border: 'none', borderRadius: 8,
                            padding: '7px 14px', cursor: referralTarget ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <Send style={{ width: 12, height: 12 }} />
                          {t('whistleblower.referToAuthority')}
                        </button>
                      </div>
                    )}

                    {/* Referral History */}
                    {report.referrals && report.referrals.length > 0 && (
                      <div style={{ background: '#fafaf9', border: '1px solid rgba(11,11,11,0.06)', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#52514e', marginBottom: 8 }}>{t('whistleblower.referralHistory')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {report.referrals.map((ref: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Send style={{ width: 11, height: 11, color: '#9e9d99' }} />
                                <span style={{ color: '#0b0b0b' }}>{getAuthorityLabel(ref.authority)}</span>
                              </div>
                              <span style={{ fontSize: 11, color: '#9e9d99' }}>{new Date(ref.referredAt).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
