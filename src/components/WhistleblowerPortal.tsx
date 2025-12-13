import { useState } from 'react';
import { AlertTriangle, Shield, Eye, EyeOff, Lock, Send, CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { addProcurementRecord } from '../utils/blockchain';

interface WhistleblowerPortalProps {
  reports: any[];
  setReports: (reports: any[]) => void;
  tenders: any[];
  contracts: any[];
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
}

export function WhistleblowerPortal({
  reports,
  setReports,
  tenders,
  contracts,
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
  });
  const [zkProof, setZkProof] = useState<string | null>(null);

  const generateZKProof = () => {
    // Simulate Zero-Knowledge Proof generation
    const proof = `ZKP-${Math.random().toString(36).substr(2, 16).toUpperCase()}`;
    setZkProof(proof);
    return proof;
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();

    const proof = generateZKProof();
    
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
        amount: 0,
        status: 'pending',
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

    setReports([...reports, newReport]);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setShowReportForm(false);
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
    'Fraud',
    'Corruption',
    'Bribery',
    'Conflict of Interest',
    'Quality Violations',
    'Financial Misconduct',
    'Contract Manipulation',
    'Unfair Bidding',
  ];

  const pendingReports = reports.filter((r) => r.investigationStatus === 'pending');
  const underInvestigation = reports.filter((r) => r.investigationStatus === 'investigating');
  const resolvedReports = reports.filter((r) => r.investigationStatus === 'resolved');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">Whistleblower Protection Portal</h2>
          <p className="text-gray-600 mt-1">Secure, anonymous reporting with Zero-Knowledge Proof protection</p>
        </div>
        <button
          onClick={() => setShowReportForm(!showReportForm)}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
        >
          <AlertTriangle className="w-5 h-5" />
          Submit Report
        </button>
      </div>

      {/* Protection Features */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-8 h-8 opacity-80" />
            <Lock className="w-6 h-6 opacity-60" />
          </div>
          <p className="opacity-90">ZKP Protection</p>
          <p className="mt-1">Guaranteed Anonymity</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-8 h-8 opacity-80" />
          </div>
          <p className="opacity-90">Total Reports</p>
          <p className="mt-1">{reports.length}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 opacity-80" />
          </div>
          <p className="opacity-90">Under Investigation</p>
          <p className="mt-1">{underInvestigation.length}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 opacity-80" />
          </div>
          <p className="opacity-90">Resolved</p>
          <p className="mt-1">{resolvedReports.length}</p>
        </div>
      </div>

      {/* Report Submission Form */}
      {showReportForm && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-gray-900">Submit Whistleblower Report</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAnonymousMode(!anonymousMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  anonymousMode
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                {anonymousMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {anonymousMode ? 'Anonymous Mode (ZKP)' : 'Identified Mode'}
              </button>
            </div>
          </div>

          {anonymousMode && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-purple-900">Zero-Knowledge Proof Protection Active</p>
                  <p className="text-purple-700 mt-1">
                    Your identity is cryptographically protected. Even administrators cannot identify you. 
                    Your report will be assigned a unique ZKP token for tracking.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitReport} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">Report Title</label>
                <input
                  type="text"
                  required
                  value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Brief description of the issue"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Category</label>
                <select
                  required
                  value={reportForm.category}
                  onChange={(e) => setReportForm({ ...reportForm, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Severity Level</label>
                <select
                  required
                  value={reportForm.severity}
                  onChange={(e) => setReportForm({ ...reportForm, severity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Select Severity</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-2">Related Tender/Contract</label>
                <select
                  value={reportForm.relatedId}
                  onChange={(e) => setReportForm({ ...reportForm, relatedId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Select if applicable</option>
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
                value={reportForm.description}
                onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Provide detailed information about what you witnessed or discovered..."
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Evidence/Supporting Information</label>
              <textarea
                value={reportForm.evidence}
                onChange={(e) => setReportForm({ ...reportForm, evidence: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Documents, dates, names, amounts, or any supporting evidence..."
              />
            </div>

            {!anonymousMode && (
              <div>
                <label className="block text-gray-700 mb-2">Secure Contact Method (Optional)</label>
                <input
                  type="text"
                  value={reportForm.contactMethod}
                  onChange={(e) => setReportForm({ ...reportForm, contactMethod: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Encrypted email or secure channel"
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Send className="w-5 h-5" />
                Submit Securely
              </button>
              <button
                type="button"
                onClick={() => setShowReportForm(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        <h3 className="text-gray-900">All Reports</h3>
        
        {reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No reports submitted yet</p>
            <p className="text-gray-500 mt-2">Reports are protected with Zero-Knowledge Proofs</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const severityColors = {
                low: 'bg-blue-100 text-blue-800',
                medium: 'bg-yellow-100 text-yellow-800',
                high: 'bg-orange-100 text-orange-800',
                critical: 'bg-red-100 text-red-800',
              };

              const statusColors = {
                pending: 'bg-gray-100 text-gray-800',
                investigating: 'bg-blue-100 text-blue-800',
                resolved: 'bg-green-100 text-green-800',
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
                          <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
                            <Shield className="w-4 h-4" />
                            ZKP Protected
                          </span>
                        )}
                      </div>

                      <p className="text-gray-600 mb-3">{report.description}</p>

                      <div className="grid grid-cols-3 gap-4 text-gray-700 mb-3">
                        <div>
                          <p className="text-gray-500">Category</p>
                          <p>{report.category}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Submitted</p>
                          <p>{new Date(report.submittedAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">ZK Proof</p>
                          <p className="font-mono text-sm">{report.zkProof}</p>
                        </div>
                      </div>

                      {report.evidence && (
                        <div className="bg-gray-50 p-4 rounded-lg mb-3">
                          <p className="text-gray-700 mb-1">Evidence:</p>
                          <p className="text-gray-600">{report.evidence}</p>
                        </div>
                      )}

                      {report.rewards.eligible && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-green-800">
                            ✓ Eligible for whistleblower reward based on investigation outcome
                          </p>
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
            <h4 className="text-purple-900 mb-2">Whistleblower Protection & Incentives</h4>
            <ul className="text-purple-800 space-y-1">
              <li>• <strong>Zero-Knowledge Proofs (ZKP):</strong> Your identity is cryptographically protected and untraceable</li>
              <li>• <strong>Blockchain Verification:</strong> Reports are immutably recorded with ZKP tokens</li>
              <li>• <strong>Incentive Mechanism:</strong> Eligible for token rewards based on report validity and impact</li>
              <li>• <strong>Multi-channel Reporting:</strong> Web, mobile app, and encrypted channels available</li>
              <li>• <strong>Legal Protection:</strong> Full protection under Afghanistan whistleblower laws</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
