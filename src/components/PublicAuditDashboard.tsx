import { useState } from 'react';
import { Eye, Search, Download, TrendingUp, DollarSign, FileText, BarChart3, PieChart, Activity } from 'lucide-react';

interface PublicAuditDashboardProps {
  tenders: any[];
  bids: any[];
  contracts: any[];
  blockchainRecords: any[];
}

export function PublicAuditDashboard({ tenders, bids, contracts, blockchainRecords }: PublicAuditDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const totalBudget = tenders.reduce((sum, t) => sum + Number(t.budget || 0), 0);
  const totalAwarded = contracts.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const avgBidsPerTender = tenders.length > 0 ? (bids.length / tenders.length).toFixed(1) : 0;
  const completionRate = contracts.length > 0 
    ? ((contracts.filter(c => c.status === 'completed').length / contracts.length) * 100).toFixed(1)
    : 0;

  // Category breakdown
  const categoryData = tenders.reduce((acc: any, tender) => {
    const cat = tender.category || 'Other';
    if (!acc[cat]) acc[cat] = { count: 0, budget: 0 };
    acc[cat].count++;
    acc[cat].budget += Number(tender.budget || 0);
    return acc;
  }, {});

  const filteredTenders = searchQuery
    ? tenders.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.department.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tenders;

  const displayTenders = filterCategory === 'all'
    ? filteredTenders
    : filteredTenders.filter(t => t.category === filterCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">Public Audit Dashboard</h2>
          <p className="text-gray-600 mt-1">Transparent view of all procurement activities - Accessible to all citizens</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Download className="w-5 h-5" />
          Export Report
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <Activity className="w-6 h-6 opacity-60" />
          </div>
          <p className="opacity-90">Total Budget</p>
          <p className="mt-1">{totalBudget.toLocaleString()} AFN</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-6 h-6 opacity-60" />
          </div>
          <p className="opacity-90">Active Tenders</p>
          <p className="mt-1">{tenders.filter(t => t.status === 'published').length}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 className="w-8 h-8 opacity-80" />
            <Activity className="w-6 h-6 opacity-60" />
          </div>
          <p className="opacity-90">Avg Bids/Tender</p>
          <p className="mt-1">{avgBidsPerTender}</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <PieChart className="w-8 h-8 opacity-80" />
            <Activity className="w-6 h-6 opacity-60" />
          </div>
          <p className="opacity-90">Completion Rate</p>
          <p className="mt-1">{completionRate}%</p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h3 className="text-gray-900 mb-4">Budget Distribution by Category</h3>
        <div className="space-y-3">
          {Object.entries(categoryData).map(([category, data]: [string, any]) => {
            const percentage = totalBudget > 0 ? ((data.budget / totalBudget) * 100).toFixed(1) : 0;
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-700">{category}</span>
                  <span className="text-gray-900">{data.budget.toLocaleString()} AFN ({percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1 flex items-center gap-3 border border-gray-300 rounded-lg px-4 py-2">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tenders by title or department..."
              className="flex-1 outline-none"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            {Object.keys(categoryData).map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tender List with Full Transparency */}
      <div className="space-y-4">
        <h3 className="text-gray-900">All Procurement Records</h3>
        {displayTenders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No records found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayTenders.map((tender) => {
              const tenderBids = bids.filter((b) => b.tenderId === tender.id);
              const tenderContract = contracts.find((c) => c.tenderId === tender.id);
              const blockchainVerified = blockchainRecords.some((r) => r.tenderId === tender.id);

              return (
                <div key={tender.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-gray-900">{tender.title}</h4>
                        <span className={`px-3 py-1 rounded-full ${
                          tender.status === 'published' ? 'bg-green-100 text-green-800' :
                          tender.status === 'awarded' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {tender.status}
                        </span>
                        {blockchainVerified && (
                          <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full">
                            <Eye className="w-4 h-4" />
                            Blockchain Verified
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3">{tender.description}</p>

                      <div className="grid grid-cols-4 gap-4 text-gray-700 mb-4">
                        <div>
                          <p className="text-gray-500">Department</p>
                          <p>{tender.department}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Budget</p>
                          <p>{Number(tender.budget).toLocaleString()} AFN</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Category</p>
                          <p>{tender.category}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Deadline</p>
                          <p>{new Date(tender.deadline).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Bidding Information */}
                      {tenderBids.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-lg mb-3">
                          <p className="text-gray-700 mb-2">{tenderBids.length} Bids Received</p>
                          <div className="space-y-2">
                            {tenderBids.map((bid, idx) => (
                              <div key={bid.id} className="flex items-center justify-between text-gray-600">
                                <span>Bid #{idx + 1}: {bid.vendorName}</span>
                                <span>{Number(bid.amount).toLocaleString()} AFN</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contract Award Information */}
                      {tenderContract && (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <p className="text-green-800 mb-2">Contract Awarded</p>
                          <div className="grid grid-cols-3 gap-4 text-gray-700">
                            <div>
                              <p className="text-gray-600">Awarded to</p>
                              <p>{tenderContract.vendorName}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Amount</p>
                              <p>{Number(tenderContract.amount).toLocaleString()} AFN</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Progress</p>
                              <p>{tenderContract.progress}%</p>
                            </div>
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

      {/* Transparency Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <Eye className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-blue-900 mb-2">Public Transparency Commitment</h4>
            <p className="text-blue-800">
              This dashboard provides complete transparency into Afghanistan's procurement process. All data is 
              verifiable on the blockchain, ensuring immutability and accountability. Citizens can audit any 
              procurement activity and verify the integrity of records independently.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
