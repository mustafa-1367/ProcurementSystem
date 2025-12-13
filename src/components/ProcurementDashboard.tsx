import React from 'react';
import { FileText, Eye, AlertTriangle, CreditCard, PlusCircle } from 'lucide-react';

interface ProcurementDashboardProps {
  setActivePhase: (p: any) => void;
  setShowWallet: (v: boolean) => void;
  tenders: any[];
  bids: any[];
  contracts: any[];
  reports: any[];
  blockchainRecords: any[];
  setTenders: (t: any[]) => void;
  setBids: (b: any[]) => void;
  setContracts: (c: any[]) => void;
  setReports: (r: any[]) => void;
  setBlockchainRecords: (r: any[]) => void;
}

export function ProcurementDashboard({
  setActivePhase,
  setShowWallet,
  tenders,
  bids,
  contracts,
  reports,
  blockchainRecords,
}: ProcurementDashboardProps) {
  const published = tenders.filter((t) => t.status === 'published').length;
  const drafts = tenders.filter((t) => t.status === 'draft').length;
  const totalBids = bids.length;
  const totalContracts = contracts.length;
  const totalReports = reports.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">Procurement Dashboard</h2>
          <p className="text-gray-600 mt-1">Centralized view and quick actions — aligned with the goal model</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWallet(true)}
            className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 hover:shadow-sm"
          >
            <CreditCard className="w-4 h-4 text-gray-700" />
            <span className="text-gray-700">Open Wallet</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <p className="text-gray-500">Tenders</p>
              <p className="text-gray-900 text-lg">{tenders.length}</p>
            </div>
          </div>
          <div className="flex gap-2 text-sm text-gray-600">
            <div>Published: {published}</div>
            <div>Drafts: {drafts}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-6 h-6 text-purple-600" />
            <div>
              <p className="text-gray-500">Audit Records</p>
              <p className="text-gray-900 text-lg">{blockchainRecords.length}</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">Verifiable & immutable</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <div>
              <p className="text-gray-500">Whistleblower</p>
              <p className="text-gray-900 text-lg">{totalReports}</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">Protected & anonymous</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <PlusCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="text-gray-500">Quick Actions</p>
              <p className="text-gray-900 text-lg">{totalBids} bids</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">Create, Publish, Evaluate</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setActivePhase('pre')}
          className="col-span-1 bg-blue-600 text-white px-4 py-3 rounded-lg flex items-center gap-2"
        >
          <FileText className="w-4 h-4" /> Create Tender
        </button>

        <button
          onClick={() => setActivePhase('tender')}
          className="col-span-1 bg-indigo-600 text-white px-4 py-3 rounded-lg flex items-center gap-2"
        >
          <FileText className="w-4 h-4" /> Go to Tendering
        </button>

        <button
          onClick={() => setActivePhase('audit')}
          className="col-span-1 bg-green-600 text-white px-4 py-3 rounded-lg flex items-center gap-2"
        >
          <Eye className="w-4 h-4" /> Open Public Audit
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="text-gray-900">Recent Tenders</h3>
        {tenders.slice().reverse().slice(0, 4).map((t) => (
          <div key={t.id} className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-900 font-medium">{t.title}</div>
                <div className="text-gray-600 text-sm">{t.department} • {t.category}</div>
              </div>
              <div className="text-gray-700">{t.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProcurementDashboard;
