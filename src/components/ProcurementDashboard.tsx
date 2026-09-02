import React from 'react';
import { FileText, Eye, AlertTriangle, PlusCircle, Shield, CheckCircle, Clock, Send, Scale, Users } from 'lucide-react';
import { useTranslation } from '../utils/i18n';
import { DashboardCharts } from './DashboardCharts';

interface ProcurementDashboardProps {
  setActivePhase: (p: any) => void;
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
  userRole: string;
  disputes?: any[];
}

export function ProcurementDashboard({
  setActivePhase,
  tenders,
  bids,
  contracts,
  reports,
  blockchainRecords,
  userRole,
  disputes = [],
}: ProcurementDashboardProps) {
  const { t } = useTranslation();

  // ── Bidder (supplier) dashboard — Sharakat Chain style ──
  if (userRole === 'supplier') {
    const activeBids = bids.filter((b) => b.status === 'submitted').length;
    const activeContracts = contracts.filter((c) => c.status === 'active').length;
    const pendingMilestones = contracts.reduce((sum, c) => {
      if (!c.milestones) return sum;
      return sum + c.milestones.filter((m: any) => m.status === 'pending').reduce((s: number, m: any) => s + (m.amount || 0), 0);
    }, 0);
    const totalDelivered = contracts.length > 0
      ? Math.round(contracts.reduce((sum, c) => sum + (c.progress || 0), 0) / contracts.length)
      : 0;

    const getBidStatus = (bid: any) => {
      // Check if this bid's tender has a contract (awarded)
      const contract = contracts.find((c) => c.tenderId === bid.tenderId);
      if (contract) {
        const isWinner = contract.vendorName === bid.vendorName;
        if (isWinner) {
          if (contract.status === 'completed') return { stage: t('bidderDash.contractCompleted'), status: t('bidderDash.contractCompleted'), statusClass: 'b-good' };
          if (contract.status === 'active') return { stage: t('bidderDash.contractActive'), status: t('bidderDash.contractActive'), statusClass: 'b-good' };
          if (contract.status === 'standstill') return { stage: t('bidderDash.standstillPeriod'), status: t('bidderDash.awarded'), statusClass: 'b-info' };
          return { stage: t('bidderDash.awarded'), status: t('bidderDash.awarded'), statusClass: 'b-good' };
        }
        return { stage: t('bidderDash.notSelected'), status: t('bidderDash.notSelected'), statusClass: 'b-default' };
      }
      // Check tender status
      const tender = tenders.find((td) => td.id === bid.tenderId);
      if (tender?.status === 'standstill' || tender?.status === 'awarded') {
        return { stage: t('bidderDash.evaluated'), status: t('bidderDash.evaluated'), statusClass: 'b-warn' };
      }
      // Check if deadline passed
      if (tender && new Date(tender.deadline).getTime() <= Date.now()) {
        return { stage: t('bidderDash.underEvaluation'), status: t('bidderDash.underEvaluation'), statusClass: 'b-warn' };
      }
      return { stage: t('bidderDash.bidSubmitted'), status: t('bidderDash.bidSubmitted'), statusClass: 'b-info' };
    };

    const recentActivity = bids.slice().reverse().slice(0, 5).map((bid) => {
      const info = getBidStatus(bid);
      return {
        tender: `${bid.tenderId} — ${bid.tenderTitle}`,
        ...info,
      };
    });

    const statStyle: React.CSSProperties = {
      background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 16,
    };
    const valStyle: React.CSSProperties = {
      fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#0b0b0b',
    };
    const lblStyle: React.CSSProperties = { color: '#6e6c66', fontSize: 12, marginTop: 2 };
    const thStyle: React.CSSProperties = {
      textAlign: 'left', color: '#6e6c66', fontWeight: 600, fontSize: '11.5px',
      textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e1e0d9', padding: '8px 10px',
    };

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: 26, letterSpacing: '-0.01em', color: '#0b0b0b' }}>
              {t('bidderDash.title')}
            </h1>
            <p style={{ margin: '0 0 10px 0', color: '#52514e' }}>{t('bidderDash.subtitle')}</p>
          </div>
        </div>

        <div className="mobile-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          <div style={statStyle}>
            <div style={valStyle}>{activeBids}</div>
            <div style={lblStyle}>{t('bidderDash.activeBids')}</div>
          </div>
          <div style={statStyle}>
            <div style={valStyle}>{activeContracts}</div>
            <div style={lblStyle}>{t('bidderDash.contractsInProgress')}</div>
          </div>
          <div style={statStyle}>
            <div style={valStyle}>{pendingMilestones.toLocaleString()} AFN</div>
            <div style={lblStyle}>{t('bidderDash.pendingMilestones')}</div>
          </div>
          <div style={statStyle}>
            <div style={valStyle}>{totalDelivered}%</div>
            <div style={lblStyle}>{t('bidderDash.onTimeDelivery')}</div>
          </div>
        </div>

        <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
          <h2 style={{ margin: '0 0 10px 0', fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', color: '#0b0b0b' }}>
            {t('bidderDash.recentActivity')}
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr>
                <th style={thStyle}>{t('bidderDash.colTender')}</th>
                <th style={thStyle}>{t('bidderDash.colStage')}</th>
                <th style={thStyle}>{t('bidderDash.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '20px 10px', color: '#6e6c66', textAlign: 'center' }}>
                    {t('bidderDash.noActivity')}
                  </td>
                </tr>
              ) : (
                recentActivity.map((row, i) => (
                  <tr key={i} style={{ cursor: 'default' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8f8f6'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '10px', borderBottom: i < recentActivity.length - 1 ? '1px solid #e1e0d9' : 'none', verticalAlign: 'top' }}>
                      {row.tender}
                    </td>
                    <td style={{ padding: '10px', borderBottom: i < recentActivity.length - 1 ? '1px solid #e1e0d9' : 'none', verticalAlign: 'top' }}>
                      {row.stage}
                    </td>
                    <td style={{ padding: '10px', borderBottom: i < recentActivity.length - 1 ? '1px solid #e1e0d9' : 'none', verticalAlign: 'top' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: '11.5px', fontWeight: 700, padding: '3px 9px',
                        borderRadius: 999, border: '1px solid', whiteSpace: 'nowrap',
                        ...(row.statusClass === 'b-good' ? { color: '#0a6b0a', background: '#eaf8ea', borderColor: '#c7ecc7' } :
                          row.statusClass === 'b-warn' ? { color: '#8a5a12', background: '#fdf3df', borderColor: '#f0dcae' } :
                          row.statusClass === 'b-info' ? { color: '#1c5cab', background: '#eef5fd', borderColor: '#bcd6f5' } :
                          { color: '#52514e', background: '#f0efec', borderColor: '#e1e0d9' }),
                      }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Auditor dashboard — #10, #12, #13 ──
  if (userRole === 'auditor') {
    const onChainRecords = blockchainRecords.filter(r => r.onChain);
    const simulatedRecords = blockchainRecords.filter(r => !r.onChain);
    const singleBidTenders = tenders.filter(td => {
      const tdBids = bids.filter(b => b.tenderId === td.id);
      return td.status !== 'draft' && tdBids.length === 1;
    });
    const overBudgetBids = bids.filter(b => {
      const tender = tenders.find(td => td.id === b.tenderId);
      if (!tender?.budget) return false;
      const budget = Number(String(tender.budget).replace(/,/g, ''));
      return Number(b.amount) > budget;
    });
    const whistleblowerReports = reports.filter(r => r.type !== 'evaluation_report');
    const flaggedForReReview = disputes.filter(d => d.flaggedForReReview);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-gray-900">{t('dashboard.titleAuditor')}</h2>
          <p className="text-gray-600 mt-1">{t('dashboard.subtitleAuditor')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { icon: Shield, label: t('dashboard.verifiedRecords'), value: onChainRecords.length, desc: `${t('dashboard.simulatedCount')}: ${simulatedRecords.length}`, accent: '#059669', bg: '#ecfdf5', iconBg: '#d1fae5' },
            { icon: AlertTriangle, label: t('dashboard.singleBidTenders'), value: singleBidTenders.length, desc: t('dashboard.riskFlag'), accent: '#d97706', bg: '#fffbeb', iconBg: '#fef3c7' },
            { icon: Scale, label: t('dashboard.overBudgetBids'), value: overBudgetBids.length, desc: t('dashboard.overBudgetBids'), accent: '#dc2626', bg: '#fef2f2', iconBg: '#fee2e2' },
            { icon: Eye, label: t('dashboard.flaggedReReview'), value: flaggedForReReview.length, desc: t('dashboard.flaggedReReview'), accent: '#7c3aed', bg: '#f5f3ff', iconBg: '#ede9fe' },
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
                <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800, color: '#0f2942', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{card.value}</p>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#9e9d98', lineHeight: 1.4 }}>{card.desc}</p>
            </div>
          ))}
        </div>

        {/* Risk Alerts — #13 */}
        {(singleBidTenders.length > 0 || overBudgetBids.length > 0) && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertTriangle style={{ width: 16, height: 16, color: '#d97706' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>{t('dashboard.riskAlerts')}</span>
            </div>
            {singleBidTenders.length > 0 && (
              <p style={{ fontSize: 13, color: '#78350f', margin: '4px 0' }}>
                {t('dashboard.singleBidWarning').replace('{{count}}', String(singleBidTenders.length))}
              </p>
            )}
            {overBudgetBids.length > 0 && (
              <p style={{ fontSize: 13, color: '#78350f', margin: '4px 0' }}>
                {t('dashboard.overBudgetWarning').replace('{{count}}', String(overBudgetBids.length))}
              </p>
            )}
          </div>
        )}

        <DashboardCharts tenders={tenders} bids={bids} contracts={contracts} blockchainRecords={blockchainRecords} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button onClick={() => setActivePhase('audit')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)', color: '#fff',
            fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(30,58,95,0.25)',
          }}>
            <Eye style={{ width: 18, height: 18 }} /> {t('dashboard.openPublicAudit')}
          </button>
          <button onClick={() => setActivePhase('dao')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)', color: '#fff',
            fontSize: 14, fontWeight: 700, boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
          }}>
            <Users style={{ width: 18, height: 18 }} /> {t('nav.daoGovernance')}
          </button>
        </div>
      </div>
    );
  }

  // ── Oversight dashboard — #14, #15, #16, #18 ──
  if (userRole === 'oversight') {
    const whistleblowerReports = reports.filter(r => r.type !== 'evaluation_report');
    const pendingReports = whistleblowerReports.filter(r => r.investigationStatus === 'pending');
    const activeInvestigations = whistleblowerReports.filter(r => r.investigationStatus === 'investigating');
    const resolvedReports = whistleblowerReports.filter(r => r.investigationStatus === 'resolved');
    const escalatedToDAO = whistleblowerReports.filter(r => r.escalatedToDAO);
    const flaggedForReReview = disputes.filter(d => d.flaggedForReReview);
    const allReferrals = whistleblowerReports.flatMap(r => (r.referrals || []).map((ref: any) => ({ ...ref, reportId: r.id, reportTitle: r.title })));
    const activeDAODisputes = disputes.filter(d => d.status === 'voting' && d.votes);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-gray-900">{t('dashboard.titleOversight')}</h2>
          <p className="text-gray-600 mt-1">{t('dashboard.subtitleOversight')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { icon: Clock, label: t('dashboard.pendingReports'), value: pendingReports.length, desc: t('dashboard.pendingReports'), accent: '#d97706', bg: '#fffbeb', iconBg: '#fef3c7' },
            { icon: Eye, label: t('dashboard.activeInvestigations'), value: activeInvestigations.length, desc: t('dashboard.activeInvestigations'), accent: '#1d4ed8', bg: '#eff6ff', iconBg: '#dbeafe' },
            { icon: CheckCircle, label: t('dashboard.resolvedCases'), value: resolvedReports.length, desc: t('dashboard.resolvedCases'), accent: '#059669', bg: '#ecfdf5', iconBg: '#d1fae5' },
            { icon: Scale, label: t('dashboard.activeDAOVotes'), value: activeDAODisputes.length, desc: t('dashboard.activeDAOVotes'), accent: '#7c3aed', bg: '#f5f3ff', iconBg: '#ede9fe' },
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
                <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800, color: '#0f2942', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Re-Review Tracking — #18 */}
        {flaggedForReReview.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <AlertTriangle style={{ width: 16, height: 16, color: '#dc2626' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>{t('dashboard.reReviewTitle')}</span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#dc2626', color: '#fff' }}>{flaggedForReReview.length}</span>
            </div>
            {flaggedForReReview.map((d: any) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #fecaca' }}>
                <span style={{ color: '#991b1b', fontWeight: 600 }}>{d.title}</span>
                <span style={{ fontSize: 11, color: '#b91c1c' }}>{d.relatedId || d.tenderId || ''}</span>
              </div>
            ))}
          </div>
        )}

        {/* Referral Summary — #16 */}
        {allReferrals.length > 0 && (
          <div style={{ background: '#fcfcfb', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 10, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Send style={{ width: 16, height: 16, color: '#6e6c66' }} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0b0b0b' }}>{t('dashboard.referralSummary')}</h3>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#f0f0ee', color: '#6e6c66' }}>{allReferrals.length}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e1e0d9', fontSize: 11, fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase' }}>{t('dashboard.colReport')}</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e1e0d9', fontSize: 11, fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase' }}>{t('dashboard.colAuthority')}</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e1e0d9', fontSize: 11, fontWeight: 600, color: '#6e6c66', textTransform: 'uppercase' }}>{t('dashboard.colDate')}</th>
                </tr>
              </thead>
              <tbody>
                {allReferrals.slice(0, 8).map((ref: any, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: '8px', borderBottom: '1px solid #f0efec', fontWeight: 600, color: '#0f2942' }}>{ref.reportTitle || ref.reportId}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #f0efec', color: '#52514e' }}>{ref.authority}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid #f0efec', color: '#6e6c66', fontSize: 12 }}>{new Date(ref.referredAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DashboardCharts tenders={tenders} bids={bids} contracts={contracts} blockchainRecords={blockchainRecords} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <button onClick={() => setActivePhase('whistleblower')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #c2410c 0%, #ea580c 100%)', color: '#fff',
            fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(234,88,12,0.25)',
          }}>
            <AlertTriangle style={{ width: 16, height: 16 }} /> {t('nav.whistleblower')}
          </button>
          <button onClick={() => setActivePhase('dao')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)', color: '#fff',
            fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
          }}>
            <Users style={{ width: 16, height: 16 }} /> {t('nav.daoGovernance')}
          </button>
          <button onClick={() => setActivePhase('audit')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)', color: '#fff',
            fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(30,58,95,0.25)',
          }}>
            <Eye style={{ width: 16, height: 16 }} /> {t('dashboard.openPublicAudit')}
          </button>
        </div>
      </div>
    );
  }

  // ── Default dashboard for all other roles ──
  const published = tenders.filter((tender) => tender.status === 'published').length;
  const drafts = tenders.filter((tender) => tender.status === 'draft').length;
  const totalBids = bids.length;
  const totalReports = reports.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900">{
            userRole === 'government' ? t('dashboard.titleEntity') :
            userRole === 'citizen' ? t('dashboard.titlePublic') :
            userRole === 'auditor' ? t('dashboard.titleAuditor') :
            userRole === 'oversight' ? t('dashboard.titleOversight') :
            t('dashboard.title')
          }</h2>
          <p className="text-gray-600 mt-1">{
            userRole === 'government' ? t('dashboard.subtitleEntity') :
            userRole === 'citizen' ? t('dashboard.subtitlePublic') :
            userRole === 'auditor' ? t('dashboard.subtitleAuditor') :
            userRole === 'oversight' ? t('dashboard.subtitleOversight') :
            t('dashboard.subtitle')
          }</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <p className="text-gray-500">{t('dashboard.tenders')}</p>
              <p className="text-gray-900 text-lg">{tenders.length}</p>
            </div>
          </div>
          <div className="flex gap-2 text-sm text-gray-600">
            <div>{t('dashboard.published')}: {published}</div>
            <div>{t('dashboard.drafts')}: {drafts}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-6 h-6 text-purple-600" />
            <div>
              <p className="text-gray-500">{t('dashboard.auditRecords')}</p>
              <p className="text-gray-900 text-lg">{blockchainRecords.length}</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">{t('dashboard.verifiable')}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <div>
              <p className="text-gray-500">{t('dashboard.whistleblower')}</p>
              <p className="text-gray-900 text-lg">{totalReports}</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">{t('dashboard.protectedAnonymous')}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <PlusCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="text-gray-500">{t('dashboard.quickActions')}</p>
              <p className="text-gray-900 text-lg">{totalBids} {t('dashboard.bids')}</p>
            </div>
          </div>
          <div className="text-sm text-gray-600">{t('dashboard.quickActionsDesc')}</div>
        </div>
      </div>

      <DashboardCharts
        tenders={tenders}
        bids={bids}
        contracts={contracts}
        blockchainRecords={blockchainRecords}
      />

      <div className="grid grid-cols-3 gap-4">
        {userRole === 'government' && (
          <button
            onClick={() => setActivePhase('pre')}
            className="col-span-1 bg-blue-600 text-white px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> {t('dashboard.createTender')}
          </button>
        )}

        {userRole === 'government' && (
          <button
            onClick={() => setActivePhase('tender')}
            className="col-span-1 bg-indigo-600 text-white px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> {t('dashboard.goToTendering')}
          </button>
        )}

        {userRole !== 'government' && (
          <button
            onClick={() => setActivePhase('audit')}
            className="col-span-1 bg-green-600 text-white px-4 py-3 rounded-lg flex items-center gap-2"
          >
            <Eye className="w-4 h-4" /> {t('dashboard.openPublicAudit')}
          </button>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-gray-900">{t('dashboard.recentTenders')}</h3>
        {tenders.slice().reverse().slice(0, 4).map((tender) => {
          const statusStyles: Record<string, { color: string; bg: string; border: string; label: string }> = {
            draft: { color: '#52514e', bg: '#f0efec', border: '#e1e0d9', label: t('dashboard.statusDraft') },
            published: { color: '#1c5cab', bg: '#eef5fd', border: '#bcd6f5', label: t('dashboard.statusPublished') },
            standstill: { color: '#8a5a12', bg: '#fdf3df', border: '#f0dcae', label: t('dashboard.statusStandstill') },
            awarded: { color: '#0a6b0a', bg: '#eaf8ea', border: '#c7ecc7', label: t('dashboard.statusAwarded') },
          };
          const s = statusStyles[tender.status] || statusStyles.draft;
          return (
            <div key={tender.id} className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-gray-900 font-medium">{tender.title}</div>
                  <div className="text-gray-600 text-sm">{tender.department} • {tender.category}</div>
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: '11.5px', fontWeight: 700, padding: '3px 9px',
                  borderRadius: 999, border: `1px solid ${s.border}`,
                  color: s.color, background: s.bg, whiteSpace: 'nowrap',
                }}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProcurementDashboard;
