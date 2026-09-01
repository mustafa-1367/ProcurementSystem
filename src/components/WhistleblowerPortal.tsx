import { useState } from 'react';
import { AlertTriangle, Shield, Eye, Send, CheckCircle, Clock, MessageSquare, Upload, X, FileText, Image, Video, Coins, Loader2 } from 'lucide-react';
import { addProcurementRecordAsync, blockchain } from '../utils/blockchain';
import { useTranslation } from '../utils/i18n';
import { generateProof, generateUserSecret, computeCommitment, formatProofForContract } from '../utils/zkProof';
import * as snarkjs from 'snarkjs';

interface WhistleblowerPortalProps {
  reports: any[];
  setReports: (reports: any[]) => void;
  tenders: any[];
  contracts: any[];
  disputes: any[];
  setDisputes: (disputes: any[]) => void;
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
  userRole: string;
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
  userRole,
}: WhistleblowerPortalProps) {
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportForm, setReportForm] = useState({
    title: '',
    category: '',
    severity: '',
    relatedId: '',
    description: '',
    evidence: '',
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

  const [zkpGenerating, setZkpGenerating] = useState(false);
  const [submitStep, setSubmitStep] = useState<string | null>(null); // progress step label
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{ reportId: string; txHash: string; onChain: boolean; zkpVerified: boolean; rewardAmount: number } | null>(null);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setZkpGenerating(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    let proofHash: string;
    let proofData: any = null;
    let zkpReal = false;

    try {
      setSubmitStep(t('whistleblower.stepGeneratingProof'));

      // Generate real ZKP using Circom/snarkjs — fresh secret per report to avoid duplicate nullifiers
      const secret = generateUserSecret().toString();

      const commitment = await computeCommitment(BigInt(secret));
      const commitments = [commitment];
      const result = await generateProof(BigInt(secret), commitments, 0);
      const formatted = formatProofForContract(result.proof);

      setSubmitStep(t('whistleblower.stepVerifyingProof'));

      // Verify the proof client-side using the verification key
      const basePath = import.meta.env.BASE_URL || '/';
      const vkeyResponse = await fetch(`${basePath}zkp/verification_key.json`);
      const vkey = await vkeyResponse.json();
      const isValid = await snarkjs.groth16.verify(vkey, result.publicSignals, result.proof);
      console.log('[ZKP] Groth16 proof generated and verified client-side:', isValid);

      proofHash = `ZKP-${result.nullifierHash.substring(0, 16).toUpperCase()}`;
      proofData = { ...formatted, merkleRoot: result.merkleRoot, nullifierHash: result.nullifierHash };
      zkpReal = isValid;
    } catch (err) {
      console.warn('Real ZKP generation failed, using fallback:', err);
      proofHash = `ZKP-FALLBACK-${Date.now().toString(16).toUpperCase()}`;
    }

    setZkProof(proofHash);

    const severityRewards: Record<string, number> = { low: 100, medium: 250, high: 500, critical: 1000 };
    const rewardAmount = severityRewards[reportForm.severity] || 100;

    const newReport = {
      id: `RPT-${Date.now()}`,
      ...reportForm,
      isAnonymous: true,
      zkProof: proofHash,
      zkpVerified: zkpReal,
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

    try {
      setSubmitStep(t('whistleblower.stepSubmittingChain'));

      // Add to blockchain with ZK proof — pass full proof + commitment for on-chain Groth16 verification
      let commitmentStr: string | undefined;
      try {
        const secret = localStorage.getItem('wb_secret');
        if (secret && proofData) {
          const cm = await computeCommitment(BigInt(secret));
          commitmentStr = cm.toString();
        }
      } catch { /* commitment will be undefined, blockchain.ts handles gracefully */ }

      const { block, contract, onChain } = await addProcurementRecordAsync('whistleblower_report', {
        reportId: newReport.id,
        zkProof: proofHash,
        category: reportForm.category,
        severity: reportForm.severity,
        anonymous: true,
        ...(proofData ? { proofData } : {}),
        ...(commitmentStr ? { commitment: commitmentStr } : {}),
      });

      const blockchainRecord = {
        id: block.hash,
        type: 'whistleblower_report',
        reportId: newReport.id,
        contractId: contract.id,
        transactionHash: contract.transactionHash,
        zkProof: proofHash,
        zkpVerified: zkpReal,
        timestamp: new Date().toISOString(),
        verified: onChain,
        simulated: !onChain,
        onChain,
      };

      setReports([...reports, newReport]);
      setBlockchainRecords([...blockchainRecords, blockchainRecord]);

      setZkpGenerating(false);
      setSubmitStep(null);
      setSubmitSuccess({
        reportId: newReport.id,
        txHash: contract.transactionHash,
        onChain,
        zkpVerified: zkpReal,
        rewardAmount,
      });

      // Reset form (but keep success visible)
      setUploadedFiles([]);
      setReportForm({
        title: '',
        category: '',
        severity: '',
        relatedId: '',
        description: '',
        evidence: '',
        reporterType: '',
        routedTo: '',
      });
    } catch (err: any) {
      console.error('Report submission failed:', err);
      setZkpGenerating(false);
      setSubmitStep(null);
      setSubmitError(err?.reason || err?.message || 'Submission failed. Please try again.');
    }
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
      status: 'voting',
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

  const handleUpdateInvestigation = (reportId: string, newStatus: string) => {
    const updatedReports = reports.map((r) => {
      if (r.id !== reportId) return r;
      const updated = { ...r, investigationStatus: newStatus };
      if (newStatus === 'resolved' && r.rewards) {
        updated.rewards = { ...r.rewards, status: 'awarded' };
      }
      return updated;
    });
    setReports(updatedReports);
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

      {/* ZKP Status Banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '14px 18px',
      }}>
        <Shield style={{ width: 20, height: 20, color: '#059669', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#065f46' }}>{t('whistleblower.simulatedFlowNotice')}</p>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#047857', lineHeight: 1.5 }}>{t('whistleblower.simulatedFlowDesc')}</p>
        </div>
      </div>

      {/* Protection Features */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: t('whistleblower.zkpProtection'), value: t('whistleblower.zkpSimulated'), icon: Shield, accent: '#059669', bg: '#ecfdf5', iconBg: '#d1fae5', isText: true },
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
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,.06)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #0f2942 0%, #1e4976 100%)', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(201,154,60,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield style={{ width: 20, height: 20, color: '#c99a3c' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>{t('whistleblower.submitWhistleblower')}</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{t('whistleblower.reportsProtected')}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmitReport} style={{ padding: '20px 28px 28px' }}>
            {/* ── Section 1: Report Details ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: '#0f2942', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#c99a3c' }}>1</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f2942' }}>{t('whistleblower.sectionReportDetails')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('whistleblower.reportTitle')}</label>
                  <input
                    type="text"
                    required
                    value={reportForm.title}
                    onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                    placeholder={t('whistleblower.titlePlaceholder')}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', transition: 'border .15s', boxSizing: 'border-box' }}
                    onFocus={(e) => { e.target.style.borderColor = '#c99a3c'; e.target.style.boxShadow = '0 0 0 3px rgba(201,154,60,.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('whistleblower.categoryLabel')}</label>
                  <select
                    required
                    value={reportForm.category}
                    onChange={(e) => setReportForm({ ...reportForm, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="">{t('whistleblower.selectCategory')}</option>
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('whistleblower.relatedTender')}</label>
                  <select
                    value={reportForm.relatedId}
                    onChange={(e) => setReportForm({ ...reportForm, relatedId: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' }}
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
            </div>

            {/* ── Section 2: Classification ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: '#0f2942', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#c99a3c' }}>2</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f2942' }}>{t('whistleblower.sectionClassification')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('whistleblower.severityLevel')}</label>
                  <select
                    required
                    value={reportForm.severity}
                    onChange={(e) => setReportForm({ ...reportForm, severity: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="">{t('whistleblower.selectSeverity')}</option>
                    <option value="low">{t('whistleblower.low')}</option>
                    <option value="medium">{t('whistleblower.medium')}</option>
                    <option value="high">{t('whistleblower.high')}</option>
                    <option value="critical">{t('whistleblower.critical')}</option>
                  </select>
                  {reportForm.severity && (
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#059669', fontWeight: 600 }}>
                      <Coins style={{ width: 12, height: 12, display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                      {t('whistleblower.rewardHint').replace('{{amount}}', { low: '100', medium: '250', high: '500', critical: '1,000' }[reportForm.severity] || '0')}
                    </p>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('whistleblower.reporterType')}</label>
                  <select
                    required
                    value={reportForm.reporterType}
                    onChange={(e) => {
                      const type = e.target.value;
                      let routedTo = '';
                      if (type === 'citizen') routedTo = 'directorate_contract_oversight';
                      if (type === 'company_supplier') routedTo = 'debarment_committee_npa';
                      if (type === 'ngo_civil_society') routedTo = 'national_inspector';
                      if (type === 'journalist_media') routedTo = 'ago';
                      if (type === 'internal_auditor') routedTo = 'sao';
                      setReportForm({ ...reportForm, reporterType: type, routedTo });
                    }}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="">{t('whistleblower.selectReporterType')}</option>
                    <option value="government_employee">{t('whistleblower.governmentEmployee')}</option>
                    <option value="citizen">{t('whistleblower.citizenReporter')}</option>
                    <option value="company_supplier">{t('whistleblower.companySupplier')}</option>
                    <option value="ngo_civil_society">{t('whistleblower.ngoCivilSociety')}</option>
                    <option value="journalist_media">{t('whistleblower.journalistMedia')}</option>
                    <option value="internal_auditor">{t('whistleblower.internalAuditor')}</option>
                  </select>
                </div>
                {reportForm.reporterType === 'government_employee' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('whistleblower.routeTo')}</label>
                    <select
                      required
                      value={reportForm.routedTo}
                      onChange={(e) => setReportForm({ ...reportForm, routedTo: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' }}
                    >
                      <option value="">{t('whistleblower.selectAuthority')}</option>
                      {ROUTING_AUTHORITIES.map((auth) => (
                        <option key={auth.value} value={auth.value}>{auth.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (reportForm.reporterType === 'citizen' || reportForm.reporterType === 'company_supplier') ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', alignSelf: 'end' }}>
                    <Shield style={{ width: 14, height: 14, color: '#2563eb', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>
                      {t('whistleblower.autoRouted')}: {getAuthorityLabel(reportForm.routedTo)}
                    </span>
                  </div>
                ) : <div />}
              </div>
            </div>

            {/* ── Section 3: Description & Evidence ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: '#0f2942', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#c99a3c' }}>3</div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0f2942' }}>{t('whistleblower.sectionEvidence')}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('whistleblower.detailedDescription')}</label>
                  <textarea
                    required
                    value={reportForm.description}
                    onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                    rows={5}
                    placeholder={t('whistleblower.descriptionCombinedPlaceholder')}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', transition: 'border .15s', boxSizing: 'border-box' }}
                    onFocus={(e) => { e.target.style.borderColor = '#c99a3c'; e.target.style.boxShadow = '0 0 0 3px rgba(201,154,60,.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{t('whistleblower.uploadEvidence')}</label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => document.getElementById('evidence-file-input')?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('evidence-file-input')?.click(); } }}
                    style={{
                      border: '2px dashed #d1d5db', borderRadius: 8, padding: '18px 14px', textAlign: 'center',
                      cursor: 'pointer', transition: 'all .15s', background: '#fafafa',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c99a3c'; e.currentTarget.style.background = '#fffbeb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = '#fafafa'; }}
                  >
                    <Upload style={{ width: 24, height: 24, color: '#9ca3af', margin: '0 auto 6px' }} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#374151' }}>{t('whistleblower.dragOrClick')}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>{t('whistleblower.acceptedFormats')}</p>
                  </div>
                  <input
                    id="evidence-file-input"
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {uploadedFiles.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {uploadedFiles.map((file, idx) => {
                    const Icon = getFileIcon(file);
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Icon style={{ width: 18, height: 18, color: '#6b7280', flexShrink: 0 }} />
                          <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#0f2942', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          aria-label={`${t('whistleblower.removeFile')} ${file.name}`}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, borderRadius: 4 }}
                        >
                          <X style={{ width: 14, height: 14, color: '#9ca3af' }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* Error Message */}
            {submitError && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 16 }}>
                <AlertTriangle style={{ width: 18, height: 18, color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#dc2626' }}>{t('whistleblower.submissionFailed')}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#991b1b' }}>{submitError}</p>
                </div>
                <button onClick={() => setSubmitError(null)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', padding: 2 }}>
                  <X style={{ width: 14, height: 14, color: '#dc2626' }} />
                </button>
              </div>
            )}

            {/* Progress Steps */}
            {zkpGenerating && (
              <div style={{ padding: '14px 18px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Loader2 style={{ width: 16, height: 16, color: '#d97706', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>{submitStep}</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#a16207' }}>{t('whistleblower.doNotClose')}</p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
              <button
                type="submit"
                disabled={zkpGenerating}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '11px 28px',
                  borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700,
                  background: zkpGenerating ? '#9ca3af' : 'linear-gradient(135deg, #0f2942, #1e4976)',
                  color: '#fff', cursor: zkpGenerating ? 'not-allowed' : 'pointer',
                  transition: 'all .15s', boxShadow: zkpGenerating ? 'none' : '0 2px 8px rgba(15,41,66,.25)',
                }}
              >
                {zkpGenerating ? (
                  <>
                    <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                    {submitStep || t('whistleblower.submitting')}
                  </>
                ) : (
                  <>
                    <Shield style={{ width: 18, height: 18 }} />
                    {t('whistleblower.submitSecurely')}
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={zkpGenerating}
                onClick={() => { setShowReportForm(false); setSubmitError(null); setSubmitSuccess(null); }}
                style={{
                  padding: '11px 24px', borderRadius: 10, border: '1.5px solid #d1d5db',
                  background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600,
                  cursor: zkpGenerating ? 'not-allowed' : 'pointer', opacity: zkpGenerating ? 0.4 : 1,
                  transition: 'all .15s',
                }}
              >
                {t('whistleblower.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Success Confirmation Modal ── */}
      {submitSuccess && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.5)' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.25)', textAlign: 'center' }}>
            {/* Success Icon */}
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle style={{ width: 32, height: 32, color: '#059669' }} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#0f2942' }}>
              {t('whistleblower.reportSubmitted')}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              {t('whistleblower.reportSubmittedDesc')}
            </p>

            {/* Details */}
            <div style={{ textAlign: 'left', background: '#f9fafb', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t('whistleblower.reportId')}</span>
                <span style={{ fontSize: 12, color: '#0f2942', fontWeight: 700, fontFamily: 'monospace' }}>{submitSuccess.reportId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t('whistleblower.zkpStatus')}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: submitSuccess.zkpVerified ? '#059669' : '#d97706' }}>
                  {submitSuccess.zkpVerified ? t('whistleblower.zkpVerified') : t('whistleblower.zkpFallback')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t('whistleblower.blockchainStatus')}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: submitSuccess.onChain ? '#059669' : '#d97706' }}>
                  {submitSuccess.onChain ? t('whistleblower.onChainConfirmed') : t('whistleblower.simulatedRecord')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t('whistleblower.rewardLabel')}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>
                  {submitSuccess.rewardAmount.toLocaleString()} PROC
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{t('whistleblower.txHash')}</span>
                <span style={{ fontSize: 11, color: '#0f2942', fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{submitSuccess.txHash}</span>
              </div>
            </div>

            {/* Next Steps */}
            <div style={{ textAlign: 'left', background: '#eff6ff', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#1e40af' }}>{t('whistleblower.nextSteps')}</h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#1e3a5f', lineHeight: 1.8 }}>
                <li>{t('whistleblower.nextStep1')}</li>
                <li>{t('whistleblower.nextStep2')}</li>
                <li>{t('whistleblower.nextStep3')}</li>
              </ul>
            </div>

            <button
              onClick={() => { setSubmitSuccess(null); setShowReportForm(false); }}
              style={{
                width: '100%', padding: '12px 24px', borderRadius: 10, border: 'none',
                background: '#0f2942', color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', transition: 'background .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1e4976'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#0f2942'; }}
            >
              {t('whistleblower.done')}
            </button>
          </div>
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
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: report.zkpVerified ? '#d1fae5' : '#f5f3ff', color: report.zkpVerified ? '#065f46' : '#7c3aed', border: report.zkpVerified ? '1px solid #a7f3d0' : '1px solid #ddd6fe', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Shield style={{ width: 10, height: 10 }} /> {report.zkpVerified ? 'ZKP Verified (Groth16)' : 'Simulated ZKP'}
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

                    {/* Investigation Workflow — only for oversight/auditor roles */}
                    {(userRole === 'oversight' || userRole === 'auditor') && report.investigationStatus === 'pending' && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8,
                        padding: '10px 14px', marginBottom: 12,
                      }}>
                        <Eye style={{ width: 16, height: 16, color: '#0369a1', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: '#0c4a6e', flex: 1 }}>{t('whistleblower.investigationRequired')}</span>
                        <button
                          onClick={() => handleUpdateInvestigation(report.id, 'investigating')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700,
                            color: '#fff', background: '#0369a1', border: 'none', borderRadius: 8,
                            padding: '7px 14px', cursor: 'pointer',
                          }}
                        >
                          {t('whistleblower.startInvestigation')}
                        </button>
                      </div>
                    )}
                    {(userRole === 'oversight' || userRole === 'auditor') && report.investigationStatus === 'investigating' && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8,
                        padding: '10px 14px', marginBottom: 12,
                      }}>
                        <CheckCircle style={{ width: 16, height: 16, color: '#059669', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: '#065f46', flex: 1 }}>{t('whistleblower.investigationRequired')}</span>
                        <button
                          onClick={() => handleUpdateInvestigation(report.id, 'resolved')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700,
                            color: '#fff', background: '#059669', border: 'none', borderRadius: 8,
                            padding: '7px 14px', cursor: 'pointer',
                          }}
                        >
                          {t('whistleblower.markResolved')}
                        </button>
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

    </div>
  );
}
