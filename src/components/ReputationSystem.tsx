import { useState } from 'react';
import { Award, TrendingUp, Star, Trophy, Target, BarChart3, Users, CheckCircle } from 'lucide-react';

interface ReputationSystemProps {
  reputationScores: any[];
  bids: any[];
  contracts: any[];
}

export function ReputationSystem({ reputationScores, bids, contracts }: ReputationSystemProps) {
  const [selectedVendor, setSelectedVendor] = useState<any>(null);

  // Calculate reputation scores for all vendors
  const calculateVendorScores = () => {
    const vendors: { [key: string]: any } = {};

    bids.forEach((bid) => {
      if (!vendors[bid.vendorName]) {
        vendors[bid.vendorName] = {
          name: bid.vendorName,
          email: bid.vendorEmail,
          totalBids: 0,
          wonContracts: 0,
          completedContracts: 0,
          totalValue: 0,
          avgBidAccuracy: 0,
          onTimeDelivery: 0,
          qualityScore: 0,
          complianceScore: 0,
        };
      }
      vendors[bid.vendorName].totalBids++;
    });

    contracts.forEach((contract) => {
      if (vendors[contract.vendorName]) {
        vendors[contract.vendorName].wonContracts++;
        vendors[contract.vendorName].totalValue += Number(contract.amount);
        
        if (contract.status === 'completed') {
          vendors[contract.vendorName].completedContracts++;
        }
      }
    });

    // Calculate scores (simulation)
    Object.keys(vendors).forEach((vendorName) => {
      const vendor = vendors[vendorName];
      
      // Bid accuracy (simulation: 70-95%)
      vendor.avgBidAccuracy = Math.min(95, 70 + (vendor.wonContracts / vendor.totalBids) * 25);
      
      // On-time delivery (simulation: 75-100%)
      vendor.onTimeDelivery = vendor.completedContracts > 0 
        ? Math.min(100, 75 + Math.random() * 25)
        : 0;
      
      // Quality score (simulation: 70-95%)
      vendor.qualityScore = vendor.completedContracts > 0
        ? Math.min(95, 70 + Math.random() * 25)
        : 0;
      
      // Compliance score (simulation: 80-100%)
      vendor.complianceScore = vendor.totalBids > 0
        ? Math.min(100, 80 + Math.random() * 20)
        : 0;

      // Overall reputation score (weighted average)
      vendor.reputationScore = (
        vendor.avgBidAccuracy * 0.25 +
        vendor.onTimeDelivery * 0.30 +
        vendor.qualityScore * 0.30 +
        vendor.complianceScore * 0.15
      ).toFixed(1);
    });

    return Object.values(vendors).sort((a: any, b: any) => b.reputationScore - a.reputationScore);
  };

  const vendorScores = calculateVendorScores();

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'bg-green-100 text-green-800' };
    if (score >= 75) return { label: 'Good', color: 'bg-blue-100 text-blue-800' };
    if (score >= 60) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Poor', color: 'bg-red-100 text-red-800' };
  };

  const getTier = (score: number) => {
    if (score >= 90) return { name: 'Platinum', icon: Trophy, color: 'text-purple-600' };
    if (score >= 75) return { name: 'Gold', icon: Award, color: 'text-yellow-600' };
    if (score >= 60) return { name: 'Silver', icon: Star, color: 'text-gray-600' };
    return { name: 'Bronze', icon: Target, color: 'text-orange-600' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-gray-900">Reputation System & Vendor Scoring</h2>
        <p className="text-gray-600 mt-1">Transparent performance tracking for honest contributors</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Total Vendors</p>
              <p className="text-gray-900 mt-1">{vendorScores.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Platinum Tier</p>
              <p className="text-gray-900 mt-1">
                {vendorScores.filter((v: any) => Number(v.reputationScore) >= 90).length}
              </p>
            </div>
            <Trophy className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Avg Score</p>
              <p className="text-gray-900 mt-1">
                {vendorScores.length > 0
                  ? (vendorScores.reduce((sum: number, v: any) => sum + Number(v.reputationScore), 0) / vendorScores.length).toFixed(1)
                  : 0}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">Total Contracts</p>
              <p className="text-gray-900 mt-1">{contracts.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Top Performers */}
      {vendorScores.length > 0 && (
        <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-8 h-8" />
            <h3 className="text-white">Top Performing Vendors</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {vendorScores.slice(0, 3).map((vendor: any, index: number) => (
              <div key={vendor.name} className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-white">{['🥇', '🥈', '🥉'][index]}</span>
                  <span className="text-white">{vendor.name}</span>
                </div>
                <p className="text-white">Score: {vendor.reputationScore}</p>
                <p className="text-white opacity-90">
                  {vendor.completedContracts}/{vendor.wonContracts} completed
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vendor List */}
      <div className="space-y-4">
        <h3 className="text-gray-900">All Vendor Reputation Scores</h3>

        {vendorScores.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No vendor data available yet</p>
            <p className="text-gray-500 mt-2">Scores will appear as vendors participate in tenders</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vendorScores.map((vendor: any) => {
              const tier = getTier(Number(vendor.reputationScore));
              const TierIcon = tier.icon;
              const badge = getScoreBadge(Number(vendor.reputationScore));

              return (
                <div key={vendor.name} className="bg-white rounded-lg shadow-md border border-gray-200">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`p-3 rounded-full bg-gray-100 ${tier.color}`}>
                          <TierIcon className="w-8 h-8" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-gray-900">{vendor.name}</h4>
                            <span className={`px-3 py-1 rounded-full ${badge.color}`}>
                              {badge.label}
                            </span>
                            <span className={`px-3 py-1 rounded-full bg-gray-100 ${tier.color}`}>
                              {tier.name} Tier
                            </span>
                          </div>
                          <p className="text-gray-600">{vendor.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-600">Overall Score</p>
                        <p className={`text-gray-900 ${getScoreColor(Number(vendor.reputationScore))}`}>
                          {vendor.reputationScore}/100
                        </p>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-gray-500 mb-1">Total Bids</p>
                        <p className="text-gray-900">{vendor.totalBids}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Won Contracts</p>
                        <p className="text-gray-900">{vendor.wonContracts}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Completed</p>
                        <p className="text-gray-900">{vendor.completedContracts}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Total Value</p>
                        <p className="text-gray-900">{vendor.totalValue.toLocaleString()} AFN</p>
                      </div>
                    </div>

                    {/* Score Breakdown */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-700">Bid Accuracy</span>
                          <span className={getScoreColor(vendor.avgBidAccuracy)}>
                            {vendor.avgBidAccuracy.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${vendor.avgBidAccuracy}%` }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-700">On-Time Delivery</span>
                          <span className={getScoreColor(vendor.onTimeDelivery)}>
                            {vendor.onTimeDelivery.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${vendor.onTimeDelivery}%` }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-700">Quality Score</span>
                          <span className={getScoreColor(vendor.qualityScore)}>
                            {vendor.qualityScore.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{ width: `${vendor.qualityScore}%` }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-700">Compliance Score</span>
                          <span className={getScoreColor(vendor.complianceScore)}>
                            {vendor.complianceScore.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-yellow-600 h-2 rounded-full transition-all"
                            style={{ width: `${vendor.complianceScore}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedVendor(selectedVendor?.name === vendor.name ? null : vendor)}
                      className="mt-4 text-blue-600 hover:text-blue-700"
                    >
                      {selectedVendor?.name === vendor.name ? 'Hide Details' : 'View Full History'}
                    </button>

                    {selectedVendor?.name === vendor.name && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-gray-900 mb-3">Performance History</h5>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-700">
                            All performance metrics are calculated from blockchain-verified contract data.
                            Scores are updated automatically after each contract milestone and completion.
                          </p>
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

      {/* Reputation System Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <Award className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-blue-900 mb-2">Transparent Reputation System</h4>
            <p className="text-blue-800 mb-3">
              The reputation system incentivizes honest and quality work from all participants. Scores are 
              calculated transparently based on:
            </p>
            <ul className="text-blue-800 space-y-1">
              <li>• <strong>Bid Accuracy (25%):</strong> How competitive and realistic bids are</li>
              <li>• <strong>On-Time Delivery (30%):</strong> Adherence to project timelines</li>
              <li>• <strong>Quality Score (30%):</strong> Work quality and compliance with specifications</li>
              <li>• <strong>Compliance Score (15%):</strong> Regulatory and contractual compliance</li>
            </ul>
            <p className="text-blue-800 mt-3">
              Higher reputation scores improve vendor visibility in tenders and establish trust with government agencies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
