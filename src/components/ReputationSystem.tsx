import { useState } from 'react';
import { Award, TrendingUp, Star, Trophy, Target, BarChart3, Users, CheckCircle } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface ReputationSystemProps {
  reputationScores: any[];
  bids: any[];
  contracts: any[];
}

export function ReputationSystem({ reputationScores, bids, contracts }: ReputationSystemProps) {
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const { t } = useTranslation();

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
    if (score >= 90) return 'text-green-700';
    if (score >= 75) return 'text-blue-700';
    if (score >= 60) return 'text-amber-700';
    return 'text-red-700';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { label: t('reputation.excellent'), color: 'bg-green-100 text-green-900' };
    if (score >= 75) return { label: t('reputation.good'), color: 'bg-blue-100 text-blue-900' };
    if (score >= 60) return { label: t('reputation.fair'), color: 'bg-amber-100 text-amber-900' };
    return { label: t('reputation.poor'), color: 'bg-red-100 text-red-900' };
  };

  const getTier = (score: number) => {
    if (score >= 90) return { name: t('reputation.platinum'), icon: Trophy, color: 'text-purple-600' };
    if (score >= 75) return { name: t('reputation.gold'), icon: Award, color: 'text-amber-700' };
    if (score >= 60) return { name: t('reputation.silver'), icon: Star, color: 'text-gray-700' };
    return { name: t('reputation.bronze'), icon: Target, color: 'text-orange-600' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-gray-900">{t('reputation.title')}</h2>
        <p className="text-gray-600 mt-1">{t('reputation.subtitle')}</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('reputation.totalVendors')}</p>
              <p className="text-gray-900 mt-1">{vendorScores.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">{t('reputation.platinumTier')}</p>
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
              <p className="text-gray-600">{t('reputation.avgScore')}</p>
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
              <p className="text-gray-600">{t('reputation.totalContracts')}</p>
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
            <h3 className="text-white">{t('reputation.topPerformers')}</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {vendorScores.slice(0, 3).map((vendor: any, index: number) => (
              <div key={vendor.name} className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-white">{['🥇', '🥈', '🥉'][index]}</span>
                  <span className="text-white">{vendor.name}</span>
                </div>
                <p className="text-white">{t('reputation.score')} {vendor.reputationScore}</p>
                <p className="text-white opacity-90">
                  {vendor.completedContracts}/{vendor.wonContracts} {t('reputation.completed')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vendor List */}
      <div className="space-y-4">
        <h3 className="text-gray-900">{t('reputation.allVendors')}</h3>

        {vendorScores.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
            <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">{t('reputation.noVendorData')}</p>
            <p className="text-gray-500 mt-2">{t('reputation.scoresAppear')}</p>
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
                        <p className="text-gray-600">{t('reputation.overallScore')}</p>
                        <p className={`text-gray-900 ${getScoreColor(Number(vendor.reputationScore))}`}>
                          {vendor.reputationScore}{t('reputation.outOf100')}
                        </p>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-gray-500 mb-1">{t('reputation.totalBids')}</p>
                        <p className="text-gray-900">{vendor.totalBids}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">{t('reputation.wonContracts')}</p>
                        <p className="text-gray-900">{vendor.wonContracts}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">{t('reputation.completedLabel')}</p>
                        <p className="text-gray-900">{vendor.completedContracts}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">{t('reputation.totalValue')}</p>
                        <p className="text-gray-900">{vendor.totalValue.toLocaleString()} {t('reputation.afn')}</p>
                      </div>
                    </div>

                    {/* Score Breakdown */}
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-700">{t('reputation.bidAccuracy')}</span>
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
                          <span className="text-gray-700">{t('reputation.onTimeDelivery')}</span>
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
                          <span className="text-gray-700">{t('reputation.qualityScore')}</span>
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
                          <span className="text-gray-700">{t('reputation.complianceScore')}</span>
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
                      className="mt-4 text-blue-700 hover:text-blue-800 underline focus:ring-2 focus:ring-blue-500 focus:outline-none rounded"
                    >
                      {selectedVendor?.name === vendor.name ? t('reputation.hideDetails') : t('reputation.viewHistory')}
                    </button>

                    {selectedVendor?.name === vendor.name && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-gray-900 mb-3">{t('reputation.performanceHistory')}</h5>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-700">
                            {t('reputation.performanceNote')}
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
            <h4 className="text-blue-900 mb-2">{t('reputation.transparentTitle')}</h4>
            <p className="text-blue-800 mb-3">
              {t('reputation.transparentDesc')}
            </p>
            <ul className="text-blue-800 space-y-1">
              <li>• <strong>Bid Accuracy (25%):</strong> {t('reputation.bidAccuracyDesc')}</li>
              <li>• <strong>On-Time Delivery (30%):</strong> {t('reputation.onTimeDesc')}</li>
              <li>• <strong>Quality Score (30%):</strong> {t('reputation.qualityDesc')}</li>
              <li>• <strong>Compliance Score (15%):</strong> {t('reputation.complianceDesc')}</li>
            </ul>
            <p className="text-blue-800 mt-3">
              {t('reputation.higherScores')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
