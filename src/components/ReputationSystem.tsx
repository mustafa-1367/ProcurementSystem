import { useState } from 'react';
import { Award, TrendingUp, Star, Trophy, Target, Users, CheckCircle, ChevronDown, ChevronUp, Shield, FileText, Banknote } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface ReputationSystemProps {
  reputationScores: any[];
  bids: any[];
  contracts: any[];
}

const GOLD = '#c99a3c';

const cardStyle: React.CSSProperties = {
  background: '#fcfcfb',
  border: '1px solid rgba(11,11,11,0.10)',
  borderRadius: 10,
  padding: 18,
};

const badgeStyle: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 700,
  padding: '3px 9px',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

export function ReputationSystem({ reputationScores, bids, contracts }: ReputationSystemProps) {
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const { t } = useTranslation();

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

    Object.keys(vendors).forEach((vendorName) => {
      const vendor = vendors[vendorName];
      vendor.avgBidAccuracy = Math.min(95, 70 + (vendor.wonContracts / vendor.totalBids) * 25);
      vendor.onTimeDelivery = vendor.completedContracts > 0
        ? Math.min(100, 75 + Math.random() * 25) : 0;
      vendor.qualityScore = vendor.completedContracts > 0
        ? Math.min(95, 70 + Math.random() * 25) : 0;
      vendor.complianceScore = vendor.totalBids > 0
        ? Math.min(100, 80 + Math.random() * 20) : 0;
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

  const getTier = (score: number) => {
    if (score >= 90) return { name: 'Platinum', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', icon: Trophy };
    if (score >= 75) return { name: 'Gold', color: '#92400e', bg: '#fef3c7', border: '#fcd34d', icon: Award };
    if (score >= 60) return { name: 'Silver', color: '#374151', bg: '#f3f4f6', border: '#d1d5db', icon: Star };
    return { name: 'Bronze', color: '#9a3412', bg: '#ffedd5', border: '#fdba74', icon: Target };
  };

  const getScoreStyle = (score: number) => {
    if (score >= 90) return { color: '#065f46', bg: '#d1fae5' };
    if (score >= 75) return { color: '#1e40af', bg: '#dbeafe' };
    if (score >= 60) return { color: '#92400e', bg: '#fef3c7' };
    return { color: '#991b1b', bg: '#fee2e2' };
  };

  const avgScore = vendorScores.length > 0
    ? (vendorScores.reduce((sum: number, v: any) => sum + Number(v.reputationScore), 0) / vendorScores.length).toFixed(1)
    : '0';

  const platinumCount = vendorScores.filter((v: any) => Number(v.reputationScore) >= 90).length;

  const renderProgressBar = (value: number, color: string, label: string, weight: string) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{label}</span>
          <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 500 }}>{weight}</span>
        </div>
        <span style={{ fontSize: '13px', fontWeight: 700, color }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ width: '100%', height: 6, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          width: `${value}%`, height: '100%', background: color,
          borderRadius: 999, transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', color: '#0b0b0b' }}>
          {t('reputation.title')}
        </h1>
        <p style={{ margin: 0, color: '#52514e' }}>{t('reputation.subtitle')}</p>
      </div>

      {/* Stats Row */}
      <div className="mobile-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: t('reputation.totalVendors'), value: vendorScores.length, icon: Users, accent: '#2563eb', bg: '#eff6ff', iconBg: '#dbeafe' },
          { label: t('reputation.platinumTier'), value: platinumCount, icon: Trophy, accent: '#7c3aed', bg: '#f5f3ff', iconBg: '#ede9fe' },
          { label: t('reputation.avgScore'), value: avgScore, icon: TrendingUp, accent: '#059669', bg: '#ecfdf5', iconBg: '#d1fae5' },
          { label: t('reputation.totalContracts'), value: contracts.length, icon: FileText, accent: '#d97706', bg: '#fffbeb', iconBg: '#fef3c7' },
        ].map((card) => (
          <div key={card.label} style={{
            ...cardStyle,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 16px',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: card.iconBg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <card.icon style={{ width: 20, height: 20, color: card.accent }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: 2 }}>{card.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f2942' }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard Podium — Top 3 */}
      {vendorScores.length > 0 && (
        <div style={{ ...cardStyle, padding: '20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, background: '#fffbeb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trophy style={{ width: 18, height: 18, color: '#d97706' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f2942' }}>{t('reputation.topPerformers')}</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: vendorScores.length >= 3 ? '1fr 1fr 1fr' : `repeat(${Math.min(vendorScores.length, 3)}, 1fr)`, gap: 12 }}>
            {vendorScores.slice(0, 3).map((vendor: any, idx: number) => {
              const medalColors = [
                { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', medal: '#F59E0B' },
                { bg: '#f8fafc', border: '#cbd5e1', text: '#475569', medal: '#94a3b8' },
                { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', medal: '#f97316' },
              ];
              const m = medalColors[idx];
              const tier = getTier(Number(vendor.reputationScore));
              const score = Number(vendor.reputationScore);
              return (
                <div key={vendor.name} style={{
                  background: '#fff',
                  borderRadius: 10,
                  padding: '16px 14px',
                  border: `1.5px solid ${m.border}`,
                  position: 'relative',
                  ...(idx === 0 ? { boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.15), 0 4px 12px rgba(245, 158, 11, 0.08)' } : {}),
                }}>
                  {/* Rank medal + Tier badge row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: m.medal, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 800, color: '#fff',
                        boxShadow: idx === 0 ? '0 2px 6px rgba(245, 158, 11, 0.35)' : 'none',
                      }}>
                        {idx + 1}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f2942' }}>{vendor.name}</span>
                    </div>
                    <span style={{ ...badgeStyle, background: tier.bg, color: tier.color, border: `1px solid ${tier.border}`, fontSize: '10px' }}>
                      {tier.name}
                    </span>
                  </div>

                  {/* Score with progress bar */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                      <span style={{ fontSize: '26px', fontWeight: 800, color: m.text, lineHeight: 1 }}>{vendor.reputationScore}</span>
                      <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>/100</span>
                    </div>
                    <div style={{ width: '100%', height: 5, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{
                        width: `${score}%`, height: '100%', background: m.medal,
                        borderRadius: 999, transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{
                      flex: 1, background: '#f9fafb', borderRadius: 6, padding: '6px 8px',
                      textAlign: 'center', border: '1px solid rgba(11,11,11,0.04)',
                    }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f2942' }}>{vendor.wonContracts}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>{t('reputation.won')}</div>
                    </div>
                    <div style={{
                      flex: 1, background: '#f9fafb', borderRadius: 6, padding: '6px 8px',
                      textAlign: 'center', border: '1px solid rgba(11,11,11,0.04)',
                    }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f2942' }}>{vendor.completedContracts}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>{t('reputation.completed')}</div>
                    </div>
                    <div style={{
                      flex: 1, background: '#f9fafb', borderRadius: 6, padding: '6px 8px',
                      textAlign: 'center', border: '1px solid rgba(11,11,11,0.04)',
                    }}>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f2942' }}>{vendor.totalBids}</div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>{t('reputation.bidsLabel')}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vendor Cards */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f2942', marginBottom: 12 }}>{t('reputation.allVendors')}</h3>

        {vendorScores.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
            <Award style={{ width: 48, height: 48, color: '#c3c2b7', margin: '0 auto 12px' }} />
            <p style={{ color: '#6e6c66', fontSize: 14 }}>{t('reputation.noVendorData')}</p>
            <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>{t('reputation.scoresAppear')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {vendorScores.map((vendor: any, idx: number) => {
              const score = Number(vendor.reputationScore);
              const tier = getTier(score);
              const scoreStyle = getScoreStyle(score);
              const TierIcon = tier.icon;
              const isExpanded = expandedVendor === vendor.name;

              return (
                <div key={vendor.name} style={cardStyle}>
                  {/* Main Row */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                    onClick={() => setExpandedVendor(isExpanded ? null : vendor.name)}
                  >
                    {/* Rank */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: tier.bg, border: `2px solid ${tier.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 800, color: tier.color,
                    }}>
                      #{idx + 1}
                    </div>

                    {/* Vendor Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f2942' }}>{vendor.name}</span>
                        <span style={{ ...badgeStyle, background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
                          <TierIcon style={{ width: 12, height: 12 }} />
                          {tier.name}
                        </span>
                        <span style={{ ...badgeStyle, background: scoreStyle.bg, color: scoreStyle.color }}>
                          {score >= 90 ? t('reputation.excellent') : score >= 75 ? t('reputation.good') : score >= 60 ? t('reputation.fair') : t('reputation.needsImprovement')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: '12px', color: '#6b7280' }}>
                        <span>{vendor.totalBids} bids</span>
                        <span>{vendor.wonContracts} won</span>
                        <span>{vendor.completedContracts} completed</span>
                        {vendor.totalValue > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Banknote style={{ width: 12, height: 12 }} />
                            {vendor.totalValue.toLocaleString()} AFN
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score Circle */}
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ position: 'relative', width: 56, height: 56 }}>
                        <svg width="56" height="56" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="24" fill="none" stroke="#f3f4f6" strokeWidth="4" />
                          <circle
                            cx="28" cy="28" r="24" fill="none"
                            stroke={tier.color} strokeWidth="4"
                            strokeDasharray={`${(score / 100) * 150.8} 150.8`}
                            strokeLinecap="round"
                            transform="rotate(-90 28 28)"
                            style={{ transition: 'stroke-dasharray 0.5s ease' }}
                          />
                        </svg>
                        <div style={{
                          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '14px', fontWeight: 800, color: tier.color,
                        }}>
                          {vendor.reputationScore}
                        </div>
                      </div>
                    </div>

                    {/* Expand Arrow */}
                    <div style={{ flexShrink: 0 }}>
                      {isExpanded
                        ? <ChevronUp style={{ width: 18, height: 18, color: '#9ca3af' }} />
                        : <ChevronDown style={{ width: 18, height: 18, color: '#9ca3af' }} />
                      }
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ marginTop: 16, borderTop: '1px solid rgba(11,11,11,0.06)', paddingTop: 16 }}>
                      {/* Score Breakdown */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                        <div>
                          {renderProgressBar(vendor.avgBidAccuracy, '#2563eb', t('reputation.bidAccuracy'), '25%')}
                          {renderProgressBar(vendor.onTimeDelivery, '#059669', t('reputation.onTimeDelivery'), '30%')}
                        </div>
                        <div>
                          {renderProgressBar(vendor.qualityScore, '#7c3aed', t('reputation.qualityScore'), '30%')}
                          {renderProgressBar(vendor.complianceScore, GOLD, t('reputation.complianceScore'), '15%')}
                        </div>
                      </div>

                      {/* Contract Summary */}
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12,
                      }}>
                        {[
                          { label: t('reputation.winRate'), value: vendor.totalBids > 0 ? `${((vendor.wonContracts / vendor.totalBids) * 100).toFixed(0)}%` : '0%' },
                          { label: t('reputation.completionRate'), value: vendor.wonContracts > 0 ? `${((vendor.completedContracts / vendor.wonContracts) * 100).toFixed(0)}%` : 'N/A' },
                          { label: t('reputation.totalValue'), value: `${vendor.totalValue.toLocaleString()} ${t('reputation.afn')}` },
                          { label: t('reputation.activeContracts'), value: vendor.wonContracts - vendor.completedContracts },
                        ].map((stat) => (
                          <div key={stat.label} style={{
                            background: '#f9fafb', borderRadius: 8, padding: '10px 12px',
                            border: '1px solid rgba(11,11,11,0.04)',
                          }}>
                            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: 2 }}>{stat.label}</div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f2942' }}>{stat.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Performance Note */}
                      <div style={{
                        marginTop: 12, padding: '10px 14px', background: '#f0f4f8', borderRadius: 8,
                        fontSize: '12px', color: '#374151', display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <Shield style={{ width: 14, height: 14, color: '#6b7280', flexShrink: 0 }} />
                        {t('reputation.performanceNote')}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scoring Methodology */}
      <div style={{
        ...cardStyle,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Award style={{ width: 20, height: 20, color: '#0f2942' }} />
          <h4 style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#0f2942' }}>{t('reputation.transparentTitle')}</h4>
        </div>
        <p style={{ fontSize: '13px', color: '#475569', marginBottom: 14 }}>
          {t('reputation.transparentDesc')}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: t('reputation.bidAccuracy'), weight: '25%', color: '#2563eb', bg: '#dbeafe', desc: t('reputation.bidAccuracyDesc') },
            { label: t('reputation.onTimeDelivery'), weight: '30%', color: '#059669', bg: '#d1fae5', desc: t('reputation.onTimeDesc') },
            { label: t('reputation.qualityScore'), weight: '30%', color: '#7c3aed', bg: '#ede9fe', desc: t('reputation.qualityDesc') },
            { label: t('reputation.complianceScore'), weight: '15%', color: GOLD, bg: '#fef3c7', desc: t('reputation.complianceDesc') },
          ].map((metric) => (
            <div key={metric.label} style={{
              background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: metric.color }}>{metric.label}</span>
                <span style={{
                  ...badgeStyle, background: metric.bg, color: metric.color, fontSize: '10px',
                }}>{metric.weight}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#6b7280', lineHeight: 1.4 }}>{metric.desc}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: 12 }}>
          {t('reputation.higherScores')}
        </p>
      </div>
    </div>
  );
}
