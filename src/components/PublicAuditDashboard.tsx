import { useState } from 'react';
import { Eye, Search, Download, TrendingUp, Banknote, FileText, BarChart3, PieChart, Activity, Clock, CheckCircle, Shield, Filter, Link as LinkIcon, Coins } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface PublicAuditDashboardProps {
  tenders: any[];
  bids: any[];
  contracts: any[];
  blockchainRecords: any[];
  userRole: string;
}

export function PublicAuditDashboard({ tenders, bids, contracts, blockchainRecords, userRole }: PublicAuditDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('all');
  const { t } = useTranslation();
  const parseBudget = (v: any) => Number(String(v).replace(/,/g, ''));

  const handleDownloadReport = () => {
    const rows: string[][] = [];
    // Header
    rows.push(['Tender Title', 'Department', 'Category', 'Budget (AFN)', 'Status', 'Deadline', 'Bids', 'Awarded To', 'Contract Amount (AFN)', 'Progress (%)', 'Blockchain Verified']);

    tenders.forEach((tender) => {
      const tenderBids = bids.filter((b) => b.tenderId === tender.id);
      const tenderContract = contracts.find((c) => c.tenderId === tender.id);
      const verified = blockchainRecords.some((r) => r.tenderId === tender.id);
      const budgetNum = parseBudget(tender.budget);

      rows.push([
        tender.title || '',
        tender.department || '',
        tender.category || '',
        isNaN(budgetNum) ? '' : String(budgetNum),
        tender.status || '',
        tender.deadline ? new Date(tender.deadline).toLocaleDateString() : '',
        String(tenderBids.length),
        tenderContract?.vendorName || '',
        tenderContract ? String(Number(tenderContract.amount)) : '',
        tenderContract ? String(tenderContract.progress || 0) : '',
        verified ? 'Yes' : 'No',
      ]);
    });

    const csvContent = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `procurement-audit-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalBudget = tenders.reduce((sum, tender) => {
    const b = parseBudget(tender.budget);
    return sum + (isNaN(b) ? 0 : b);
  }, 0);
  const totalAwarded = contracts.reduce((sum, c) => {
    const a = Number(c.amount);
    return sum + (isNaN(a) ? 0 : a);
  }, 0);
  const avgBidsPerTender = tenders.length > 0 ? (bids.length / tenders.length).toFixed(1) : 0;
  const completionRate = contracts.length > 0
    ? ((contracts.filter(c => c.status === 'completed').length / contracts.length) * 100).toFixed(1)
    : 0;

  // Category breakdown
  const categoryData = tenders.reduce((acc: any, tender) => {
    const cat = tender.category || 'Other';
    if (!acc[cat]) acc[cat] = { count: 0, budget: 0 };
    acc[cat].count++;
    const b = parseBudget(tender.budget);
    acc[cat].budget += isNaN(b) ? 0 : b;
    return acc;
  }, {});

  const filteredTenders = searchQuery
    ? tenders.filter(
        (tender) =>
          tender.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tender.department.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tenders;

  const displayTenders = filterCategory === 'all'
    ? filteredTenders
    : filteredTenders.filter((tender) => tender.category === filterCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">{t('audit.title')}</h2>
          <p className="text-gray-600 mt-1">{t('audit.subtitle')}</p>
        </div>
        <button
          onClick={handleDownloadReport}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-5 h-5" />
          {t('audit.downloadReport')}
        </button>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: t('audit.totalBudget'), value: `${totalBudget.toLocaleString()} ${t('audit.afn')}`, icon: Banknote, accent: '#1d4ed8', bg: '#eff6ff', iconBg: '#dbeafe' },
          { label: t('audit.activeTenders'), value: tenders.filter((tender) => tender.status === 'published').length, icon: FileText, accent: '#059669', bg: '#ecfdf5', iconBg: '#d1fae5' },
          { label: t('audit.avgBids'), value: avgBidsPerTender, icon: BarChart3, accent: '#7c3aed', bg: '#f5f3ff', iconBg: '#ede9fe' },
          { label: t('audit.completionRate'), value: `${completionRate}%`, icon: PieChart, accent: '#d97706', bg: '#fffbeb', iconBg: '#fef3c7' },
        ].map((card, i) => (
          <div key={i} style={{
            background: '#fff', borderRadius: 12, padding: '20px 18px',
            border: '1px solid rgba(11,11,11,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: card.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <card.icon style={{ width: 20, height: 20, color: card.accent }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#6e6c66' }}>{card.label}</p>
              <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: '#0b0b0b', letterSpacing: '-0.02em' }}>{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      {(() => {
        const categoryColors: Record<string, { bar: string; bg: string; text: string; icon: string }> = {
          'Infrastructure':    { bar: '#3b82f6', bg: '#eef5fd', text: '#1c5cab', icon: '🏗️' },
          'Healthcare':        { bar: '#22c55e', bg: '#eaf8ea', text: '#0a6b0a', icon: '🏥' },
          'Education':         { bar: '#8b5cf6', bg: '#f3eefe', text: '#7c3aed', icon: '🎓' },
          'IT & Technology':   { bar: '#06b6d4', bg: '#ecfeff', text: '#0e7490', icon: '💻' },
          'Defense & Security':{ bar: '#ef4444', bg: '#fef2f2', text: '#b91c1c', icon: '🛡️' },
          'Agriculture':       { bar: '#f59e0b', bg: '#fef9ee', text: '#92400e', icon: '🌾' },
          'Transportation':    { bar: '#f97316', bg: '#fff7ed', text: '#c2410c', icon: '🚛' },
        };
        const defaultCatColor = { bar: '#6b7280', bg: '#f3f4f6', text: '#374151', icon: '📋' };

        const entries = Object.entries(categoryData).sort((a: any, b: any) => b[1].budget - a[1].budget);
        const maxBudget = entries.length > 0 ? Math.max(...entries.map(([, d]: any) => d.budget)) : 1;

        return (
          <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #e8e7e4' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(30,58,95,0.25)' }}>
                    <PieChart style={{ width: 22, height: 22, color: '#fff' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('audit.budgetDistribution')}</h3>
                    <p style={{ margin: '2px 0 0', color: '#6e6c66', fontSize: 13 }}>{t('audit.totalBudget')}: {totalBudget.toLocaleString()} {t('audit.afn')}</p>
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6e6c66' }}>{entries.length} {entries.length === 1 ? 'category' : 'categories'}</span>
              </div>
            </div>

            <div style={{ padding: '16px 28px 24px' }}>
              {entries.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9e9d98', padding: '32px 0', fontSize: 14 }}>No budget data available</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {entries.map(([category, data]: [string, any]) => {
                    const pct = totalBudget > 0 ? ((data.budget / totalBudget) * 100) : 0;
                    const barWidth = maxBudget > 0 ? ((data.budget / maxBudget) * 100) : 0;
                    const colors = categoryColors[category] || defaultCatColor;

                    return (
                      <div
                        key={category}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                          background: '#fff', borderRadius: 10, border: '1px solid #e8e7e4',
                          transition: 'box-shadow 0.15s, border-color 0.15s', cursor: 'default',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = colors.bar + '40'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = '#e8e7e4'; }}
                      >
                        {/* Category icon */}
                        <div style={{
                          width: 42, height: 42, borderRadius: 10, background: colors.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 20, flexShrink: 0,
                        }}>
                          {colors.icon}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 14, color: '#0b0b0b' }}>{category}</span>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                                color: colors.text, background: colors.bg, border: `1px solid ${colors.bar}30`,
                              }}>
                                {data.count} {data.count === 1 ? 'tender' : 'tenders'}
                              </span>
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 14, color: '#0b0b0b', fontVariantNumeric: 'tabular-nums' }}>
                              {data.budget.toLocaleString()} {t('audit.afn')}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1, height: 8, background: '#f0efec', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{
                                width: `${barWidth}%`, height: '100%', borderRadius: 999,
                                background: `linear-gradient(90deg, ${colors.bar}, ${colors.bar}cc)`,
                                transition: 'width 0.6s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: colors.text, minWidth: 42, textAlign: 'right' }}>
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* All Procurement Records */}
      {(() => {
        const statusStyles: Record<string, { color: string; bg: string; border: string; label: string }> = {
          draft:     { color: '#52514e', bg: '#f0efec', border: '#e1e0d9', label: t('dashboard.statusDraft') },
          published: { color: '#1c5cab', bg: '#eef5fd', border: '#bcd6f5', label: t('dashboard.statusPublished') },
          standstill:{ color: '#8a5a12', bg: '#fdf3df', border: '#f0dcae', label: t('dashboard.statusStandstill') },
          awarded:   { color: '#0a6b0a', bg: '#eaf8ea', border: '#c7ecc7', label: t('dashboard.statusAwarded') },
        };

        return (
          <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 14, overflow: 'hidden' }}>
            {/* Header with integrated search */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #e8e7e4' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(30,58,95,0.25)' }}>
                    <FileText style={{ width: 22, height: 22, color: '#fff' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('audit.allRecords')}</h3>
                    <p style={{ margin: '2px 0 0', color: '#6e6c66', fontSize: 13 }}>{t('audit.subtitle')}</p>
                  </div>
                </div>
                <span style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5a8e)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '5px 14px', borderRadius: 999 }}>
                  {displayTenders.length} {displayTenders.length === 1 ? 'record' : 'records'}
                </span>
              </div>

              {/* Search & Filter */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e1e0d9', borderRadius: 10, padding: '8px 14px', background: '#fff' }}>
                  <Search style={{ width: 16, height: 16, color: '#9e9d98' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('audit.searchPlaceholder')}
                    style={{ flex: 1, outline: 'none', border: 'none', fontSize: 13, color: '#0b0b0b', background: 'transparent' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e1e0d9', borderRadius: 10, padding: '8px 14px', background: '#fff' }}>
                  <Filter style={{ width: 16, height: 16, color: '#9e9d98' }} />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{ outline: 'none', border: 'none', fontSize: 13, color: '#0b0b0b', background: 'transparent', cursor: 'pointer' }}
                  >
                    <option value="all">{t('audit.allCategories')}</option>
                    {Object.keys(categoryData).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Records */}
            {displayTenders.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <Eye style={{ width: 48, height: 48, color: '#d1d0cc', margin: '0 auto 12px' }} />
                <p style={{ color: '#9e9d98', fontSize: 14 }}>{t('audit.noRecords')}</p>
              </div>
            ) : (
              <div style={{ padding: '16px 28px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {displayTenders.map((tender) => {
                  const tenderBids = bids.filter((b) => b.tenderId === tender.id);
                  const tenderContract = contracts.find((c) => c.tenderId === tender.id);
                  const blockchainVerified = blockchainRecords.some((r) => r.tenderId === tender.id);
                  const s = statusStyles[tender.status] || statusStyles.draft;
                  const budgetNum = parseBudget(tender.budget);
                  const budgetDisplay = isNaN(budgetNum) ? '—' : budgetNum.toLocaleString();

                  return (
                    <div
                      key={tender.id}
                      style={{
                        background: '#fff', borderRadius: 12, border: '1px solid #e8e7e4',
                        overflow: 'hidden', transition: 'box-shadow 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = '#d0cfca'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = '#e8e7e4'; }}
                    >
                      {/* Title bar */}
                      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0efec' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontWeight: 700, fontSize: 16, color: '#0b0b0b', letterSpacing: '-0.01em' }}>{tender.title}</h4>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 11.5, fontWeight: 700, padding: '3px 10px',
                            borderRadius: 999, border: `1px solid ${s.border}`,
                            color: s.color, background: s.bg,
                          }}>
                            {s.label}
                          </span>
                          {blockchainVerified && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 11, fontWeight: 700, padding: '3px 9px',
                              borderRadius: 999, color: '#6d28d9', background: '#f3eefe', border: '1px solid #ddd6fe',
                            }}>
                              <Shield style={{ width: 12, height: 12 }} />
                              {t('audit.blockchainVerified')}
                            </span>
                          )}
                        </div>
                        {tender.description && (
                          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6e6c66', lineHeight: 1.5 }}>{tender.description}</p>
                        )}
                      </div>

                      {/* Details grid */}
                      <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                        {[
                          { label: t('preTender.department'), value: tender.department },
                          { label: t('preTender.budget'), value: `${budgetDisplay} ${t('audit.afn')}` },
                          { label: t('preTender.category'), value: tender.category },
                          { label: t('preTender.submissionDeadline'), value: new Date(tender.deadline).toLocaleDateString() },
                        ].map((item, i) => (
                          <div key={i}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#9e9d98', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{item.label}</div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0b0b0b' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Bidding Information */}
                      {tenderBids.length > 0 && (
                        <div style={{ margin: '0 20px 14px', borderRadius: 10, overflow: 'hidden', border: '1px solid #e8e7e4' }}>
                          <div style={{ padding: '10px 14px', background: '#f8f8f6', borderBottom: '1px solid #e8e7e4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0b0b0b' }}>
                              {tenderBids.length} {t('audit.bidsReceived')}
                            </span>
                            {new Date(tender.deadline) > new Date() && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 11, fontWeight: 700, padding: '2px 8px',
                                borderRadius: 999, color: '#8a5a12', background: '#fdf3df', border: '1px solid #f0dcae',
                              }}>
                                <Shield style={{ width: 11, height: 11 }} />
                                {t('audit.bidsSealed')}
                              </span>
                            )}
                          </div>
                          {new Date(tender.deadline) <= new Date() ? (
                            <div>
                              {tenderBids.map((bid, idx) => (
                                <div key={bid.id} style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '9px 14px', fontSize: 13, color: '#52514e',
                                  borderBottom: idx < tenderBids.length - 1 ? '1px solid #f0efec' : 'none',
                                  background: tenderContract && tenderContract.vendorName === bid.vendorName ? '#eaf8ea' : '#fff',
                                }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 20, height: 20, borderRadius: 999, background: '#f0efec', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#6e6c66' }}>{idx + 1}</span>
                                    <span style={{ fontWeight: 600, color: '#0b0b0b' }}>{bid.vendorName}</span>
                                    {tenderContract && tenderContract.vendorName === bid.vendorName && (
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, color: '#0a6b0a', background: '#d1fae5', border: '1px solid #bbf7d0' }}>Winner</span>
                                    )}
                                  </span>
                                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#0b0b0b' }}>
                                    {Number(bid.amount).toLocaleString()} {t('audit.afn')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ padding: '16px 14px', textAlign: 'center', color: '#8a5a12', fontSize: 13 }}>
                              {t('audit.bidsSealed')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Contract Award */}
                      {tenderContract && (
                        <div style={{ margin: '0 20px 16px', borderRadius: 10, border: '1px solid #bbf7d0', background: '#f0fdf4', overflow: 'hidden' }}>
                          <div style={{ padding: '10px 14px', background: '#dcfce7', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle style={{ width: 14, height: 14, color: '#0a6b0a' }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#0a6b0a' }}>{t('audit.contractAwarded')}</span>
                          </div>
                          <div style={{ padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('audit.awardedTo')}</div>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b0b0b' }}>{tenderContract.vendorName}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('audit.amount')}</div>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0b0b0b' }}>{Number(tenderContract.amount).toLocaleString()} {t('audit.afn')}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{t('audit.progress')}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 8, background: '#e8e7e4', borderRadius: 999, overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${tenderContract.progress || 0}%`, height: '100%', borderRadius: 999,
                                    background: (tenderContract.progress || 0) === 100 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'linear-gradient(90deg, #3b82f6, #2563eb)',
                                    transition: 'width 0.6s ease',
                                  }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: (tenderContract.progress || 0) === 100 ? '#0a6b0a' : '#1c5cab', minWidth: 32 }}>
                                  {tenderContract.progress || 0}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Chronological Audit Log */}
      {(() => {
        const typeLabels: Record<string, string> = {
          tender_created: t('audit.tenderCreated'),
          tender_published: t('audit.tenderPublished'),
          bid_submitted: t('audit.bidSubmitted'),
          contract_awarded: t('audit.contractAwarded'),
          payment_processed: t('audit.paymentProcessed'),
          dispute_raised: t('audit.disputeRaised'),
          report_submitted: t('audit.reportSubmitted'),
          wallet_transaction: t('audit.walletTransaction'),
        };

        const typeStyles: Record<string, { bg: string; color: string; border: string; dot: string; iconBg: string }> = {
          tender_created:    { bg: '#eef5fd', color: '#1c5cab', border: '#bcd6f5', dot: '#3b82f6', iconBg: '#dbeafe' },
          tender_published:  { bg: '#eef0fd', color: '#4338ca', border: '#c7d2fe', dot: '#6366f1', iconBg: '#e0e7ff' },
          bid_submitted:     { bg: '#f3eefe', color: '#7c3aed', border: '#ddd6fe', dot: '#8b5cf6', iconBg: '#ede9fe' },
          contract_awarded:  { bg: '#eaf8ea', color: '#0a6b0a', border: '#bbf7d0', dot: '#22c55e', iconBg: '#dcfce7' },
          payment_processed: { bg: '#fef9ee', color: '#92400e', border: '#fde68a', dot: '#f59e0b', iconBg: '#fef3c7' },
          dispute_raised:    { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', dot: '#ef4444', iconBg: '#fee2e2' },
          report_submitted:  { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', dot: '#f97316', iconBg: '#ffedd5' },
          wallet_transaction:{ bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc', dot: '#06b6d4', iconBg: '#cffafe' },
        };

        const typeIcons: Record<string, typeof FileText> = {
          tender_created: FileText,
          tender_published: FileText,
          bid_submitted: TrendingUp,
          contract_awarded: CheckCircle,
          payment_processed: Banknote,
          dispute_raised: Shield,
          report_submitted: Eye,
          wallet_transaction: LinkIcon,
        };

        const getRecordDetails = (record: any) => {
          const tender = tenders.find((td) => td.id === record.tenderId);
          const bid = bids.find((b) => b.id === record.bidId);
          const contract = contracts.find((c) => c.id === record.contractId);

          switch (record.type) {
            case 'tender_created':
              return { actor: tender?.department || t('audit.systemActor'), detail: tender?.title || record.tenderId };
            case 'tender_published':
              return { actor: tender?.department || t('audit.systemActor'), detail: tender?.title || record.tenderId };
            case 'bid_submitted': {
              const deadlinePassed = tender && new Date(tender.deadline).getTime() <= Date.now();
              if (deadlinePassed) {
                return { actor: bid?.vendorName || t('audit.systemActor'), detail: `${tender?.title || ''} — ${Number(bid?.amount || 0).toLocaleString()} ${t('audit.afn')}` };
              }
              return { actor: t('audit.sealedBidActor'), detail: tender?.title || record.tenderId };
            }
            case 'contract_awarded':
              return { actor: contract?.vendorName || t('audit.systemActor'), detail: tender?.title || record.tenderId };
            case 'payment_processed':
              return { actor: t('audit.systemActor'), detail: `${Number(record.amount || 0).toLocaleString()} ${t('audit.afn')}` };
            default:
              return { actor: t('audit.systemActor'), detail: typeLabels[record.type] || record.type };
          }
        };

        const sortedRecords = [...blockchainRecords].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        const uniqueTypes = [...new Set(blockchainRecords.map((r: any) => r.type))];

        const filteredRecords = sortedRecords.filter((record) => {
          if (auditFilter !== 'all' && record.type !== auditFilter) return false;
          if (auditSearch) {
            const q = auditSearch.toLowerCase();
            const details = getRecordDetails(record);
            return (
              (record.transactionHash || '').toLowerCase().includes(q) ||
              (typeLabels[record.type] || record.type).toLowerCase().includes(q) ||
              details.actor.toLowerCase().includes(q) ||
              details.detail.toLowerCase().includes(q)
            );
          }
          return true;
        });

        // Group records by date
        const groupedByDate: Record<string, any[]> = {};
        filteredRecords.forEach((record) => {
          const dateKey = new Date(record.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
          groupedByDate[dateKey].push(record);
        });

        const defaultStyle = typeStyles.tender_created;

        return (
          <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 14, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #e8e7e4' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(30,58,95,0.25)' }}>
                    <Clock style={{ width: 22, height: 22, color: '#fff' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>{t('audit.auditLogTitle')}</h3>
                    <p style={{ margin: '2px 0 0', color: '#6e6c66', fontSize: 13 }}>{t('audit.auditLogSubtitle')}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d5a8e)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '5px 14px', borderRadius: 999 }}>
                    {filteredRecords.length} {t('audit.entries')}
                  </span>
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e1e0d9', borderRadius: 10, padding: '8px 14px', background: '#fff' }}>
                  <Search style={{ width: 16, height: 16, color: '#9e9d98' }} />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder={t('audit.auditSearchPlaceholder')}
                    style={{ flex: 1, outline: 'none', border: 'none', fontSize: 13, color: '#0b0b0b', background: 'transparent' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e1e0d9', borderRadius: 10, padding: '8px 14px', background: '#fff' }}>
                  <Filter style={{ width: 16, height: 16, color: '#9e9d98' }} />
                  <select
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    style={{ outline: 'none', border: 'none', fontSize: 13, color: '#0b0b0b', background: 'transparent', cursor: 'pointer' }}
                  >
                    <option value="all">{t('audit.allActionTypes')}</option>
                    {uniqueTypes.map((type) => (
                      <option key={type} value={type}>{typeLabels[type] || type}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Log Entries */}
            {filteredRecords.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <Clock style={{ width: 48, height: 48, color: '#d1d0cc', margin: '0 auto 12px' }} />
                <p style={{ color: '#9e9d98', fontSize: 14 }}>{t('audit.noAuditEntries')}</p>
              </div>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {Object.entries(groupedByDate).map(([dateLabel, records]) => (
                  <div key={dateLabel}>
                    {/* Date Header */}
                    <div style={{ padding: '16px 28px 8px', position: 'sticky', top: 0, zIndex: 2, background: '#fcfcfb' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#6e6c66', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                          {dateLabel}
                        </span>
                        <div style={{ flex: 1, height: 1, background: '#e8e7e4' }} />
                        <span style={{ fontSize: 11, color: '#9e9d98', fontWeight: 600 }}>
                          {records.length} {records.length === 1 ? 'entry' : 'entries'}
                        </span>
                      </div>
                    </div>

                    {/* Timeline entries */}
                    <div style={{ position: 'relative', paddingLeft: 28 }}>
                      {/* Vertical timeline line */}
                      <div style={{ position: 'absolute', left: 48, top: 0, bottom: 0, width: 2, background: 'linear-gradient(180deg, #e1e0d9 0%, #f0efec 100%)' }} />

                      {records.map((record, idx) => {
                        const details = getRecordDetails(record);
                        const TypeIcon = typeIcons[record.type] || Shield;
                        const style = typeStyles[record.type] || defaultStyle;
                        const time = new Date(record.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div
                            key={record.id}
                            style={{ position: 'relative', display: 'flex', gap: 20, padding: '10px 28px 10px 0', marginLeft: 0, cursor: 'default', transition: 'background 0.15s' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8f8f6'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            {/* Timeline dot */}
                            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 42, flexShrink: 0 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 10, background: style.iconBg,
                                border: `2px solid ${style.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: `0 1px 4px ${style.border}`,
                              }}>
                                <TypeIcon style={{ width: 16, height: 16, color: style.color }} />
                              </div>
                            </div>

                            {/* Card content */}
                            <div style={{
                              flex: 1, minWidth: 0, background: '#fff', borderRadius: 10,
                              border: '1px solid #e8e7e4', padding: '14px 18px',
                              transition: 'box-shadow 0.15s, border-color 0.15s',
                            }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = style.border; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = '#e8e7e4'; }}
                            >
                              {/* Top row: badge + time */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  fontSize: 11.5, fontWeight: 700, padding: '3px 10px',
                                  borderRadius: 999, border: `1px solid ${style.border}`,
                                  color: style.color, background: style.bg,
                                }}>
                                  {typeLabels[record.type] || record.type}
                                </span>
                                <span style={{ fontSize: 12, color: '#9e9d98', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                                  {time}
                                </span>
                              </div>

                              {/* Actor and detail */}
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 14 }}>
                                <span style={{ fontWeight: 700, color: '#0b0b0b', whiteSpace: 'nowrap' }}>{details.actor}</span>
                                <span style={{ color: '#c4c3bf' }}>•</span>
                                <span style={{ color: '#52514e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{details.detail}</span>
                              </div>

                              {/* Transaction hash + badges */}
                              {(record.transactionHash || record.hash) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                  <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    background: '#f5f5f3', borderRadius: 6, padding: '4px 10px',
                                    border: '1px solid #e8e7e4',
                                  }}>
                                    <LinkIcon style={{ width: 12, height: 12, color: '#9e9d98' }} />
                                    <code style={{ fontSize: 11.5, color: '#6e6c66', fontFamily: '"SF Mono", "Fira Code", monospace', letterSpacing: '-0.02em' }}>
                                      {(record.transactionHash || record.hash).slice(0, 22)}...
                                    </code>
                                  </div>
                                  {record.verified ? (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      fontSize: 11, fontWeight: 700, padding: '3px 9px',
                                      borderRadius: 999, color: '#0a6b0a', background: '#eaf8ea', border: '1px solid #c7ecc7',
                                    }}>
                                      <CheckCircle style={{ width: 12, height: 12 }} />
                                      {t('audit.verified')}
                                    </span>
                                  ) : (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      fontSize: 11, fontWeight: 700, padding: '3px 9px',
                                      borderRadius: 999, color: '#52514e', background: '#f0efec', border: '1px solid #e1e0d9',
                                    }}>
                                      <Activity style={{ width: 12, height: 12 }} />
                                      {t('audit.unverified')}
                                    </span>
                                  )}
                                  {record.onChain && (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      fontSize: 11, fontWeight: 700, padding: '3px 9px',
                                      borderRadius: 999, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7',
                                    }}>
                                      ● On-Chain
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Citizen Rewards Info — only visible to citizens */}
      {userRole === 'citizen' && (
        <div style={{
          background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)',
          border: '1px solid #fde68a', borderRadius: 14, padding: '20px 24px',
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: '#fbbf24',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(251,191,36,0.35)',
          }}>
            <Coins style={{ width: 22, height: 22, color: '#fff' }} />
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 16, color: '#92400e' }}>
              {t('rewards.citizenRewardsTitle')}
            </h4>
            <p style={{ margin: 0, fontSize: 13.5, color: '#78350f', lineHeight: 1.6 }}>
              {t('rewards.citizenRewardsText')}
            </p>
          </div>
        </div>
      )}

      {/* Transparency Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <Eye className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-blue-900 mb-2">{t('audit.transparencyTitle')}</h4>
            <p className="text-blue-800">
              {t('audit.transparencyText')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
