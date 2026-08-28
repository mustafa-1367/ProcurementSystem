import { useState, useEffect } from 'react';
import { Award, CheckCircle, Banknote, Calendar, FileText, Shield, AlertCircle, Clock, Flag, ChevronDown, ChevronUp } from 'lucide-react';
import { addProcurementRecordAsync } from '../utils/blockchain';

interface PostTenderingPhaseProps {
  tenders: any[];
  bids: any[];
  contracts: any[];
  setContracts: (contracts: any[]) => void;
  setTenders: (tenders: any[]) => void;
  setBlockchainRecords: (records: any[]) => void;
  blockchainRecords: any[];
  setReputationScores: (scores: any[]) => void;
  reputationScores: any[];
  reports: any[];
  setReports: (reports: any[]) => void;
  disputes: any[];
  setDisputes: (disputes: any[]) => void;
  userRole: string;
}

interface EvalDatum {
  preliminaryPass: boolean;
  docsComplete: boolean;
  bidSecurity: boolean;
  meetsRequirements: boolean;
  technicalScore: number;
  financialScore: number;
  combinedScore: number;
}

const cardStyle: React.CSSProperties = {
  background: '#fcfcfb',
  border: '1px solid rgba(11,11,11,0.10)',
  borderRadius: 10,
  padding: 18,
};

const navyBtnStyle: React.CSSProperties = {
  background: '#0f2942',
  color: '#fff',
  borderRadius: 8,
  padding: '9px 15px',
  fontSize: '13.5px',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
};

const badgeStyle: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 700,
  padding: '3px 9px',
  borderRadius: 999,
  display: 'inline-block',
};

const GOLD = '#c99a3c';

const STAGE_LABELS = ['Preliminary Check', 'Technical Evaluation', 'Financial Evaluation', 'Combined Score & Ranking'];

function StandstillCountdown({ endDate }: { endDate: string }) {
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      return { days, hours, minutes, seconds, expired: false };
    };
    setRemaining(calc());
    const interval = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  if (remaining.expired) {
    return <span style={{ color: '#065f46', fontWeight: 700, fontSize: '13px' }}>Standstill period complete</span>;
  }

  const boxStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: '#f0f4f8',
    borderRadius: 6,
    padding: '6px 10px',
    minWidth: 48,
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Clock style={{ width: 16, height: 16, color: GOLD }} />
      <div style={{ display: 'flex', gap: 6 }}>
        {[
          { val: remaining.days, label: 'd' },
          { val: remaining.hours, label: 'h' },
          { val: remaining.minutes, label: 'm' },
          { val: remaining.seconds, label: 's' },
        ].map((unit) => (
          <div key={unit.label} style={boxStyle}>
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#0f2942' }}>{String(unit.val).padStart(2, '0')}</span>
            <span style={{ fontSize: '10px', color: '#6b7280' }}>{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PostTenderingPhase({
  tenders,
  bids,
  contracts,
  setContracts,
  setTenders,
  setBlockchainRecords,
  blockchainRecords,
  setReputationScores,
  reputationScores,
  reports,
  setReports,
  disputes,
  setDisputes,
  userRole,
}: PostTenderingPhaseProps) {
  const [selectedTender, setSelectedTender] = useState<any>(null);
  const [evalStages, setEvalStages] = useState<{ [tenderId: string]: number }>({});
  const [evalData, setEvalData] = useState<{ [bidId: string]: EvalDatum }>({});
  const [expandedReports, setExpandedReports] = useState<{ [reportId: string]: boolean }>({});

  // Protest form state
  const [protestOpen, setProtestOpen] = useState<{ [contractId: string]: boolean }>({});
  const [protestCategory, setProtestCategory] = useState<{ [contractId: string]: string }>({});
  const [protestExplanation, setProtestExplanation] = useState<{ [contractId: string]: string }>({});

  // Countdown refresh trigger
  const [, setTick] = useState(0);
  useEffect(() => {
    const hasStandstill = contracts.some((c) => c.status === 'standstill');
    if (!hasStandstill) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [contracts]);

  const tendersWithBids = tenders.filter((td) => {
    const tenderBids = bids.filter((b) => b.tenderId === td.id);
    return tenderBids.length > 0 && (td.status === 'published' || td.status === 'standstill');
  });

  const getTenderBids = (tenderId: string) => bids.filter((b) => b.tenderId === tenderId);

  const getEvalDatum = (bidId: string): EvalDatum => {
    return evalData[bidId] || {
      preliminaryPass: false,
      docsComplete: false,
      bidSecurity: false,
      meetsRequirements: false,
      technicalScore: 0,
      financialScore: 0,
      combinedScore: 0,
    };
  };

  const updateEvalDatum = (bidId: string, partial: Partial<EvalDatum>) => {
    setEvalData((prev) => ({
      ...prev,
      [bidId]: { ...getEvalDatum(bidId), ...partial },
    }));
  };

  const getCurrentStage = (tenderId: string): number => evalStages[tenderId] || 1;

  const advanceStage = (tenderId: string) => {
    const current = getCurrentStage(tenderId);
    if (current < 4) {
      setEvalStages((prev) => ({ ...prev, [tenderId]: current + 1 }));
    }
  };

  const computeCombinedScores = (tenderId: string) => {
    const tenderBids = getTenderBids(tenderId);
    const updated = { ...evalData };
    tenderBids.forEach((bid) => {
      const datum = updated[bid.id] || getEvalDatum(bid.id);
      if (datum.preliminaryPass) {
        datum.combinedScore = Math.round((datum.technicalScore * 0.7 + datum.financialScore * 0.3) * 100) / 100;
      }
      updated[bid.id] = datum;
    });
    setEvalData(updated);
  };

  const getRankedBids = (tenderId: string) => {
    const tenderBids = getTenderBids(tenderId);
    return tenderBids
      .filter((bid) => getEvalDatum(bid.id).preliminaryPass)
      .sort((a, b) => getEvalDatum(b.id).combinedScore - getEvalDatum(a.id).combinedScore);
  };

  const generateEvaluationReport = async (tender: any) => {
    const tenderBids = getTenderBids(tender.id);
    const ranked = getRankedBids(tender.id);
    const winner = ranked[0];
    const winnerDatum = winner ? getEvalDatum(winner.id) : null;

    const report = {
      id: `RPT-${Date.now()}`,
      type: 'evaluation_report',
      tenderId: tender.id,
      tenderTitle: tender.title,
      generatedAt: new Date().toISOString(),
      bidsReceived: tenderBids.map((bid) => ({
        bidId: bid.id,
        vendorName: bid.vendorName,
        amount: bid.amount,
        timeline: bid.timeline,
      })),
      evaluationResults: ranked.map((bid, idx) => {
        const datum = getEvalDatum(bid.id);
        return {
          bidId: bid.id,
          vendorName: bid.vendorName,
          preliminaryPass: datum.preliminaryPass,
          technicalScore: datum.technicalScore,
          financialScore: datum.financialScore,
          combinedScore: datum.combinedScore,
          rank: idx + 1,
        };
      }),
      recommendedWinner: winner
        ? { bidId: winner.id, vendorName: winner.vendorName, combinedScore: winnerDatum!.combinedScore }
        : null,
      summary: winner
        ? `Evaluation complete for "${tender.title}". ${tenderBids.length} bids received, ${ranked.length} passed preliminary screening. ${winner.vendorName} is the recommended winner with a combined score of ${winnerDatum!.combinedScore.toFixed(2)} (Technical: ${winnerDatum!.technicalScore}, Financial: ${winnerDatum!.financialScore}).`
        : `Evaluation complete for "${tender.title}". No qualifying bids found.`,
    };

    const { block, contract, onChain } = await addProcurementRecordAsync('evaluation_report', {
      reportId: report.id,
      tenderId: tender.id,
      recommendedWinner: winner?.vendorName || 'N/A',
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'evaluation_report',
      reportId: report.id,
      tenderId: tender.id,
      smartContractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
    };

    setReports([...reports, report]);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
  };

  const awardContract = async (tender: any, bid: any) => {
    const datum = getEvalDatum(bid.id);
    const newContract = {
      id: `CNT-${Date.now()}`,
      tenderId: tender.id,
      tenderTitle: tender.title,
      bidId: bid.id,
      vendorName: bid.vendorName,
      vendorEmail: bid.vendorEmail,
      amount: bid.amount,
      timeline: bid.timeline,
      status: 'standstill',
      awardDecisionDate: new Date().toISOString(),
      standstillEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      awardedAt: new Date().toISOString(),
      evaluationSummary: {
        technicalScore: datum.technicalScore,
        financialScore: datum.financialScore,
        combinedScore: datum.combinedScore,
      },
      milestones: [
        { id: 1, name: 'Initial Payment (30%)', percentage: 30, status: 'pending', amount: Number(bid.amount) * 0.3 },
        { id: 2, name: 'Mid-project Payment (40%)', percentage: 40, status: 'pending', amount: Number(bid.amount) * 0.4 },
        { id: 3, name: 'Final Payment (30%)', percentage: 30, status: 'pending', amount: Number(bid.amount) * 0.3 },
      ],
      progress: 0,
    };

    const { block, contract, onChain } = await addProcurementRecordAsync('award', {
      tenderId: tender.id,
      bidderId: bid.id,
      amount: bid.amount,
      vendor: bid.vendorName,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'contract_awarded',
      tenderId: tender.id,
      contractId: newContract.id,
      smartContractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
    };

    const updatedTenders = tenders.map((td) =>
      td.id === tender.id ? { ...td, status: 'standstill' } : td
    );

    setContracts([...contracts, newContract]);
    setTenders(updatedTenders);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setSelectedTender(null);
  };

  const finalizeContract = (contractId: string) => {
    const updatedContracts = contracts.map((c) => {
      if (c.id === contractId) {
        return { ...c, status: 'active' };
      }
      return c;
    });
    const targetContract = contracts.find((c) => c.id === contractId);
    if (targetContract) {
      const updatedTenders = tenders.map((td) =>
        td.id === targetContract.tenderId ? { ...td, status: 'awarded' } : td
      );
      setTenders(updatedTenders);
    }
    setContracts(updatedContracts);
  };

  const skipStandstill = (contractId: string) => {
    finalizeContract(contractId);
  };

  const fileProtest = async (contractObj: any) => {
    const category = protestCategory[contractObj.id] || '';
    const explanation = protestExplanation[contractObj.id] || '';
    if (!category || !explanation.trim()) return;

    const dispute = {
      id: `DSP-${Date.now()}`,
      type: 'award_protest',
      contractId: contractObj.id,
      tenderId: contractObj.tenderId,
      tenderTitle: contractObj.tenderTitle,
      vendorName: contractObj.vendorName,
      category,
      explanation: explanation.trim(),
      filedAt: new Date().toISOString(),
      status: 'pending',
      filedBy: userRole,
    };

    const { block, contract, onChain } = await addProcurementRecordAsync('award_protest', {
      disputeId: dispute.id,
      contractId: contractObj.id,
      category,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'award_protest',
      disputeId: dispute.id,
      contractId: contractObj.id,
      smartContractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
    };

    setDisputes([...disputes, dispute]);
    setBlockchainRecords([...blockchainRecords, blockchainRecord]);
    setProtestOpen((prev) => ({ ...prev, [contractObj.id]: false }));
    setProtestCategory((prev) => ({ ...prev, [contractObj.id]: '' }));
    setProtestExplanation((prev) => ({ ...prev, [contractObj.id]: '' }));
  };

  const processMilestonePayment = async (contractId: string, milestoneId: number) => {
    const targetContract = contracts.find((c) => c.id === contractId);
    if (!targetContract) return;

    const milestone = targetContract.milestones.find((m: any) => m.id === milestoneId);
    if (!milestone) return;

    const { block, contract, onChain } = await addProcurementRecordAsync('payment', {
      contractId,
      amount: milestone.amount,
      milestone: milestone.name,
      milestoneId,
    });

    const blockchainRecord = {
      id: block.hash,
      type: 'payment_processed',
      contractId,
      milestoneId,
      smartContractId: contract.id,
      transactionHash: contract.transactionHash,
      amount: milestone.amount,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
    };

    setBlockchainRecords([...blockchainRecords, blockchainRecord]);

    const updatedContracts = contracts.map((c) => {
      if (c.id === contractId) {
        const updatedMilestones = c.milestones.map((m: any) =>
          m.id === milestoneId ? { ...m, status: 'paid', paidAt: new Date().toISOString() } : m
        );
        const progress = (updatedMilestones.filter((m: any) => m.status === 'paid').length / updatedMilestones.length) * 100;
        return {
          ...c,
          milestones: updatedMilestones,
          progress,
          status: progress === 100 ? 'completed' : 'active',
        };
      }
      return c;
    });

    setContracts(updatedContracts);
  };

  const getContractProtests = (contractId: string) =>
    disputes.filter((d) => d.contractId === contractId && d.type === 'award_protest');

  const renderStepper = (tenderId: string) => {
    const current = getCurrentStage(tenderId);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20 }}>
        {STAGE_LABELS.map((label, idx) => {
          const stageNum = idx + 1;
          const isActive = stageNum === current;
          const isComplete = stageNum < current;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: isComplete || isActive ? '#fff' : '#9ca3af',
                    background: isComplete ? '#065f46' : isActive ? '#0f2942' : '#e5e7eb',
                    transition: 'all 0.2s',
                  }}
                >
                  {isComplete ? <CheckCircle style={{ width: 18, height: 18 }} /> : stageNum}
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#0f2942' : isComplete ? '#065f46' : '#9ca3af',
                    marginTop: 4,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              </div>
              {idx < STAGE_LABELS.length - 1 && (
                <div
                  style={{
                    height: 2,
                    flex: 1,
                    background: stageNum < current ? '#065f46' : '#e5e7eb',
                    marginTop: -16,
                    minWidth: 20,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderStage1 = (tender: any) => {
    const tenderBids = getTenderBids(tender.id);
    const allChecked = tenderBids.every((bid) => {
      const datum = getEvalDatum(bid.id);
      return datum.preliminaryPass || (!datum.docsComplete && !datum.bidSecurity && !datum.meetsRequirements);
    });

    return (
      <div>
        <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2942', marginBottom: 12 }}>
          Stage 1: Preliminary Check
        </h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tenderBids.map((bid) => {
            const datum = getEvalDatum(bid.id);
            return (
              <div key={bid.id} style={{ ...cardStyle, opacity: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: '#0f2942', fontSize: '14px' }}>{bid.vendorName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {Number(bid.amount).toLocaleString()} AFN
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={datum.preliminaryPass}
                        onChange={(e) => updateEvalDatum(bid.id, { preliminaryPass: e.target.checked })}
                        style={{ accentColor: '#065f46' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: datum.preliminaryPass ? '#065f46' : '#dc2626' }}>
                        {datum.preliminaryPass ? 'Pass' : 'Fail'}
                      </span>
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[
                    { key: 'docsComplete' as const, label: 'Documents complete' },
                    { key: 'bidSecurity' as const, label: 'Bid security attached' },
                    { key: 'meetsRequirements' as const, label: 'Meets basic requirements' },
                  ].map((item) => (
                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                      <input
                        type="checkbox"
                        checked={datum[item.key]}
                        onChange={(e) => updateEvalDatum(bid.id, { [item.key]: e.target.checked })}
                        style={{ accentColor: '#0f2942' }}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button style={navyBtnStyle} onClick={() => advanceStage(tender.id)}>
            Complete Stage 1
          </button>
        </div>
      </div>
    );
  };

  const renderStage2 = (tender: any) => {
    const tenderBids = getTenderBids(tender.id);
    const passingBids = tenderBids.filter((bid) => getEvalDatum(bid.id).preliminaryPass);
    const failedBids = tenderBids.filter((bid) => !getEvalDatum(bid.id).preliminaryPass);

    return (
      <div>
        <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2942', marginBottom: 12 }}>
          Stage 2: Technical Evaluation
        </h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {passingBids.map((bid) => {
            const datum = getEvalDatum(bid.id);
            return (
              <div key={bid.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: '#0f2942', fontSize: '14px' }}>{bid.vendorName}</span>
                  <span style={{ ...badgeStyle, background: '#d1fae5', color: '#065f46' }}>Passed Preliminary</span>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: 2 }}>Technical Proposal: {bid.technicalProposal}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>Experience: {bid.experience}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Technical Score (0-100):</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={datum.technicalScore || ''}
                    onChange={(e) => updateEvalDatum(bid.id, { technicalScore: Math.min(100, Math.max(0, Number(e.target.value))) })}
                    style={{
                      width: 80,
                      padding: '6px 10px',
                      border: '1px solid rgba(11,11,11,0.15)',
                      borderRadius: 6,
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>
            );
          })}
          {failedBids.map((bid) => (
            <div key={bid.id} style={{ ...cardStyle, opacity: 0.45 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#6b7280', fontSize: '14px' }}>{bid.vendorName}</span>
                <span style={{ ...badgeStyle, background: '#fee2e2', color: '#991b1b' }}>Failed Preliminary</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button style={navyBtnStyle} onClick={() => advanceStage(tender.id)}>
            Complete Stage 2
          </button>
        </div>
      </div>
    );
  };

  const renderStage3 = (tender: any) => {
    const tenderBids = getTenderBids(tender.id);
    const passingBids = tenderBids.filter((bid) => getEvalDatum(bid.id).preliminaryPass);
    const failedBids = tenderBids.filter((bid) => !getEvalDatum(bid.id).preliminaryPass);

    return (
      <div>
        <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2942', marginBottom: 12 }}>
          Stage 3: Financial Evaluation
        </h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {passingBids.map((bid) => {
            const datum = getEvalDatum(bid.id);
            const budgetStr = tender.budget ? `${Number(tender.budget).toLocaleString()} AFN` : 'N/A';
            const bidAmountNum = Number(bid.amount);
            const budgetNum = Number(tender.budget) || 0;
            const withinBudget = budgetNum > 0 && bidAmountNum <= budgetNum;
            return (
              <div key={bid.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: '#0f2942', fontSize: '14px' }}>{bid.vendorName}</span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Technical: {datum.technicalScore}/100</span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#6b7280' }}>Bid Amount: </span>
                    <span style={{ fontWeight: 600, color: '#0f2942' }}>{bidAmountNum.toLocaleString()} AFN</span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Budget: </span>
                    <span style={{ fontWeight: 600, color: '#0f2942' }}>{budgetStr}</span>
                  </div>
                  {budgetNum > 0 && (
                    <span style={{ ...badgeStyle, background: withinBudget ? '#d1fae5' : '#fef3c7', color: withinBudget ? '#065f46' : '#92400e' }}>
                      {withinBudget ? 'Within Budget' : 'Over Budget'}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Financial Score (0-100):</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={datum.financialScore || ''}
                    onChange={(e) => updateEvalDatum(bid.id, { financialScore: Math.min(100, Math.max(0, Number(e.target.value))) })}
                    style={{
                      width: 80,
                      padding: '6px 10px',
                      border: '1px solid rgba(11,11,11,0.15)',
                      borderRadius: 6,
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>
            );
          })}
          {failedBids.map((bid) => (
            <div key={bid.id} style={{ ...cardStyle, opacity: 0.45 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#6b7280', fontSize: '14px' }}>{bid.vendorName}</span>
                <span style={{ ...badgeStyle, background: '#fee2e2', color: '#991b1b' }}>Failed Preliminary</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            style={navyBtnStyle}
            onClick={() => {
              computeCombinedScores(tender.id);
              advanceStage(tender.id);
            }}
          >
            Complete Stage 3
          </button>
        </div>
      </div>
    );
  };

  const renderStage4 = (tender: any) => {
    const ranked = getRankedBids(tender.id);
    const failedBids = getTenderBids(tender.id).filter((bid) => !getEvalDatum(bid.id).preliminaryPass);
    const reportExists = reports.some((r) => r.tenderId === tender.id && r.type === 'evaluation_report');

    return (
      <div>
        <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2942', marginBottom: 12 }}>
          Stage 4: Combined Score & Ranking
        </h5>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Rank</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Vendor</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Technical (70%)</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Financial (30%)</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Combined</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((bid, idx) => {
                const datum = getEvalDatum(bid.id);
                const isWinner = idx === 0;
                return (
                  <tr
                    key={bid.id}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: isWinner ? '#fefce8' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px', fontWeight: 700, color: isWinner ? GOLD : '#374151' }}>
                      #{idx + 1}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, color: '#0f2942' }}>{bid.vendorName}</span>
                        {isWinner && (
                          <span style={{ ...badgeStyle, background: GOLD, color: '#fff' }}>
                            Recommended Winner
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{datum.technicalScore}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{datum.financialScore}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: isWinner ? GOLD : '#0f2942' }}>
                      {datum.combinedScore.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {isWinner && (
                        <button
                          style={{ ...navyBtnStyle, background: '#065f46', fontSize: '12px', padding: '6px 12px' }}
                          onClick={() => awardContract(tender, bid)}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Award style={{ width: 14, height: 14 }} /> Award Contract
                          </span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {failedBids.map((bid) => (
                <tr key={bid.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: 0.4 }}>
                  <td style={{ padding: '10px', color: '#9ca3af' }}>-</td>
                  <td style={{ padding: '10px', color: '#9ca3af' }}>{bid.vendorName}</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#9ca3af' }}>-</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#9ca3af' }}>-</td>
                  <td style={{ padding: '10px', textAlign: 'right', color: '#9ca3af' }}>-</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{ ...badgeStyle, background: '#fee2e2', color: '#991b1b' }}>Disqualified</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Generate Evaluation Report */}
        <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {!reportExists ? (
            <button
              style={{ ...navyBtnStyle, background: GOLD }}
              onClick={() => generateEvaluationReport(tender)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <FileText style={{ width: 14, height: 14 }} /> Generate Evaluation Report
              </span>
            </button>
          ) : (
            <span style={{ ...badgeStyle, background: '#d1fae5', color: '#065f46' }}>Report Generated</span>
          )}
        </div>
      </div>
    );
  };

  const renderEvaluationReports = () => {
    const evalReports = reports.filter((r) => r.type === 'evaluation_report');
    if (evalReports.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f2942' }}>Evaluation Reports</h3>
        {evalReports.map((report) => {
          const isExpanded = expandedReports[report.id] || false;
          return (
            <div key={report.id} style={cardStyle}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpandedReports((prev) => ({ ...prev, [report.id]: !isExpanded }))}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <FileText style={{ width: 16, height: 16, color: GOLD }} />
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f2942' }}>{report.tenderTitle}</span>
                    <span style={{ ...badgeStyle, background: '#ede9fe', color: '#5b21b6' }}>{report.id}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    Generated: {new Date(report.generatedAt).toLocaleString()}
                  </span>
                </div>
                {isExpanded ? <ChevronUp style={{ width: 18, height: 18, color: '#6b7280' }} /> : <ChevronDown style={{ width: 18, height: 18, color: '#6b7280' }} />}
              </div>
              {isExpanded && (
                <div style={{ marginTop: 14, borderTop: '1px solid rgba(11,11,11,0.08)', paddingTop: 14 }}>
                  <p style={{ fontSize: '13px', color: '#374151', marginBottom: 14, lineHeight: 1.5 }}>{report.summary}</p>

                  <h6 style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>
                    Bids Received
                  </h6>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: 16 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280' }}>Vendor</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280' }}>Amount</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280' }}>Timeline</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.bidsReceived.map((b: any) => (
                        <tr key={b.bidId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '6px 8px', color: '#374151' }}>{b.vendorName}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#374151' }}>{Number(b.amount).toLocaleString()} AFN</td>
                          <td style={{ padding: '6px 8px', color: '#374151' }}>{b.timeline}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h6 style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 8 }}>
                    Evaluation Results
                  </h6>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280' }}>Rank</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280' }}>Vendor</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', color: '#6b7280' }}>Preliminary</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280' }}>Technical</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280' }}>Financial</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280' }}>Combined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.evaluationResults.map((r: any) => (
                        <tr key={r.bidId} style={{ borderBottom: '1px solid #f3f4f6', background: r.rank === 1 ? '#fefce8' : 'transparent' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: r.rank === 1 ? GOLD : '#374151' }}>#{r.rank}</td>
                          <td style={{ padding: '6px 8px', color: '#374151', fontWeight: r.rank === 1 ? 700 : 400 }}>{r.vendorName}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <span style={{ ...badgeStyle, background: r.preliminaryPass ? '#d1fae5' : '#fee2e2', color: r.preliminaryPass ? '#065f46' : '#991b1b' }}>
                              {r.preliminaryPass ? 'Pass' : 'Fail'}
                            </span>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#374151' }}>{r.technicalScore}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#374151' }}>{r.financialScore}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: r.rank === 1 ? GOLD : '#374151' }}>{r.combinedScore.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {report.recommendedWinner && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#fefce8', borderRadius: 8, border: `1px solid ${GOLD}33` }}>
                      <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 700 }}>
                        Recommended Winner: {report.recommendedWinner.vendorName} (Combined Score: {report.recommendedWinner.combinedScore.toFixed(2)})
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900">Post-Tendering Phase</h2>
        <p className="text-gray-600 mt-1">Evaluate bids, award contracts, and manage payments</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div style={cardStyle}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: '13px', color: '#6b7280' }}>Total Bids</p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#0f2942', marginTop: 2 }}>{bids.length}</p>
            </div>
            <FileText style={{ width: 28, height: 28, color: '#3b82f6' }} />
          </div>
        </div>
        <div style={cardStyle}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: '13px', color: '#6b7280' }}>Active Contracts</p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#0f2942', marginTop: 2 }}>{contracts.filter((c) => c.status === 'active').length}</p>
            </div>
            <Award style={{ width: 28, height: 28, color: '#15803d' }} />
          </div>
        </div>
        <div style={cardStyle}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: '13px', color: '#6b7280' }}>Standstill</p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#0f2942', marginTop: 2 }}>{contracts.filter((c) => c.status === 'standstill').length}</p>
            </div>
            <Clock style={{ width: 28, height: 28, color: GOLD }} />
          </div>
        </div>
        <div style={cardStyle}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: '13px', color: '#6b7280' }}>Total Value</p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#0f2942', marginTop: 2 }}>
                {contracts.reduce((sum, c) => sum + Number(c.amount), 0).toLocaleString()} AFN
              </p>
            </div>
            <Banknote style={{ width: 28, height: 28, color: GOLD }} />
          </div>
        </div>
      </div>

      {/* Bid Evaluation Section */}
      <div className="space-y-4">
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f2942' }}>Bid Evaluation</h3>
        {tendersWithBids.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
            <AlertCircle style={{ width: 48, height: 48, color: '#d1d5db', margin: '0 auto 12px' }} />
            <p style={{ color: '#6b7280', fontSize: '14px' }}>No tenders with bids available for evaluation</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tendersWithBids.map((tender) => {
              const tenderBids = getTenderBids(tender.id);
              const isAwarded = tender.status === 'awarded' || tender.status === 'standstill';
              const currentStage = getCurrentStage(tender.id);
              const isSelected = selectedTender?.id === tender.id;

              return (
                <div key={tender.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isSelected && !isAwarded ? 16 : 0 }}>
                    <div>
                      <h4 style={{ fontWeight: 700, color: '#0f2942', fontSize: '15px', margin: 0 }}>{tender.title}</h4>
                      <p style={{ color: '#6b7280', fontSize: '13px', marginTop: 2 }}>{tenderBids.length} bids received</p>
                    </div>
                    {isAwarded ? (
                      <span style={{ ...badgeStyle, background: tender.status === 'standstill' ? '#fef3c7' : '#d1fae5', color: tender.status === 'standstill' ? '#92400e' : '#065f46' }}>
                        {tender.status === 'standstill' ? 'Standstill Period' : 'Contract Awarded'}
                      </span>
                    ) : (
                      <button
                        onClick={() => setSelectedTender(isSelected ? null : tender)}
                        style={navyBtnStyle}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Award style={{ width: 14, height: 14 }} />
                          {isSelected ? 'Close Evaluation' : 'Evaluate & Award'}
                        </span>
                      </button>
                    )}
                  </div>

                  {isSelected && !isAwarded && (
                    <div style={{ borderTop: '1px solid rgba(11,11,11,0.08)', paddingTop: 16 }}>
                      {renderStepper(tender.id)}
                      {currentStage === 1 && renderStage1(tender)}
                      {currentStage === 2 && renderStage2(tender)}
                      {currentStage === 3 && renderStage3(tender)}
                      {currentStage === 4 && renderStage4(tender)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Evaluation Reports */}
      {renderEvaluationReports()}

      {/* Contract Management */}
      <div className="space-y-4">
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f2942' }}>Contract Management</h3>
        {contracts.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: 48 }}>
            <Award style={{ width: 48, height: 48, color: '#d1d5db', margin: '0 auto 12px' }} />
            <p style={{ color: '#6b7280', fontSize: '14px' }}>No contracts yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {contracts.map((contractObj) => {
              const isStandstill = contractObj.status === 'standstill';
              const standstillExpired = isStandstill && new Date(contractObj.standstillEndDate).getTime() <= Date.now();
              const contractProtests = getContractProtests(contractObj.id);
              const isProtestFormOpen = protestOpen[contractObj.id] || false;

              return (
                <div key={contractObj.id} style={cardStyle}>
                  {/* Contract Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <h4 style={{ fontWeight: 700, color: '#0f2942', fontSize: '15px', margin: 0 }}>{contractObj.tenderTitle}</h4>
                        <span
                          style={{
                            ...badgeStyle,
                            background: contractObj.status === 'completed'
                              ? '#d1fae5'
                              : contractObj.status === 'standstill'
                              ? '#fef3c7'
                              : '#dbeafe',
                            color: contractObj.status === 'completed'
                              ? '#065f46'
                              : contractObj.status === 'standstill'
                              ? '#92400e'
                              : '#1e40af',
                          }}
                        >
                          {contractObj.status === 'completed'
                            ? 'Completed'
                            : contractObj.status === 'standstill'
                            ? 'Standstill Period'
                            : 'Active'}
                        </span>
                        {blockchainRecords.some((r) => r.contractId === contractObj.id && r.onChain) && (
                          <span style={{ ...badgeStyle, color: '#065f46', background: '#d1fae5', border: '1px solid #6ee7b7', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            ● On-Chain
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 20, fontSize: '13px', color: '#6b7280' }}>
                        <span>Vendor: {contractObj.vendorName}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Banknote style={{ width: 14, height: 14 }} />
                          {Number(contractObj.amount).toLocaleString()} AFN
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar style={{ width: 14, height: 14 }} />
                          {contractObj.timeline}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Standstill Section */}
                  {isStandstill && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <h5 style={{ margin: 0, fontWeight: 700, fontSize: '13.5px', color: '#92400e' }}>
                            7-Day Standstill Period
                          </h5>
                          <p style={{ fontSize: '12px', color: '#a16207', marginTop: 2 }}>
                            Award decision published on {new Date(contractObj.awardDecisionDate).toLocaleDateString()}. Parties may file protests during this period.
                          </p>
                        </div>
                        {contractProtests.length > 0 && (
                          <span style={{ ...badgeStyle, background: '#fee2e2', color: '#991b1b' }}>
                            {contractProtests.length} protest{contractProtests.length !== 1 ? 's' : ''} filed
                          </span>
                        )}
                      </div>

                      <StandstillCountdown endDate={contractObj.standstillEndDate} />

                      {/* Award Decision Details */}
                      {contractObj.evaluationSummary && (
                        <div style={{ marginTop: 10, fontSize: '12px', color: '#78350f' }}>
                          <span style={{ fontWeight: 600 }}>Award Decision: </span>
                          Technical: {contractObj.evaluationSummary.technicalScore} | Financial: {contractObj.evaluationSummary.financialScore} | Combined: {contractObj.evaluationSummary.combinedScore.toFixed(2)}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button
                          style={{
                            ...navyBtnStyle,
                            background: standstillExpired ? '#065f46' : '#9ca3af',
                            cursor: standstillExpired ? 'pointer' : 'not-allowed',
                            opacity: standstillExpired ? 1 : 0.7,
                          }}
                          disabled={!standstillExpired}
                          onClick={() => finalizeContract(contractObj.id)}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle style={{ width: 14, height: 14 }} />
                            {standstillExpired ? 'Finalize Contract' : 'Awaiting Standstill Expiry'}
                          </span>
                        </button>
                        <button
                          style={{ ...navyBtnStyle, background: '#6b7280', fontSize: '12px' }}
                          onClick={() => skipStandstill(contractObj.id)}
                        >
                          Skip Standstill (Demo)
                        </button>
                      </div>

                      {/* Protest Filing (non-government) */}
                      {userRole !== 'government' && (
                        <div style={{ marginTop: 12 }}>
                          {!isProtestFormOpen ? (
                            <button
                              style={{ ...navyBtnStyle, background: '#dc2626', fontSize: '12px' }}
                              onClick={() => setProtestOpen((prev) => ({ ...prev, [contractObj.id]: true }))}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Flag style={{ width: 13, height: 13 }} /> File Award Protest
                              </span>
                            </button>
                          ) : (
                            <div style={{ background: '#fff', border: '1px solid rgba(11,11,11,0.10)', borderRadius: 8, padding: 14, marginTop: 8 }}>
                              <h6 style={{ margin: '0 0 10px 0', fontWeight: 700, fontSize: '13px', color: '#991b1b' }}>File Award Protest</h6>
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                                  Protest Category
                                </label>
                                <select
                                  value={protestCategory[contractObj.id] || ''}
                                  onChange={(e) => setProtestCategory((prev) => ({ ...prev, [contractObj.id]: e.target.value }))}
                                  style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    border: '1px solid rgba(11,11,11,0.15)',
                                    borderRadius: 6,
                                    fontSize: '13px',
                                    background: '#fff',
                                  }}
                                >
                                  <option value="">Select category...</option>
                                  <option value="Evaluation error">Evaluation error</option>
                                  <option value="Conflict of interest">Conflict of interest</option>
                                  <option value="Procedural violation">Procedural violation</option>
                                  <option value="Other">Other</option>
                                </select>
                              </div>
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                                  Detailed Explanation
                                </label>
                                <textarea
                                  value={protestExplanation[contractObj.id] || ''}
                                  onChange={(e) => setProtestExplanation((prev) => ({ ...prev, [contractObj.id]: e.target.value }))}
                                  rows={3}
                                  style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    border: '1px solid rgba(11,11,11,0.15)',
                                    borderRadius: 6,
                                    fontSize: '13px',
                                    resize: 'vertical',
                                  }}
                                  placeholder="Describe the grounds for your protest..."
                                />
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  style={{ ...navyBtnStyle, background: '#dc2626', fontSize: '12px' }}
                                  onClick={() => fileProtest(contractObj)}
                                  disabled={!protestCategory[contractObj.id] || !protestExplanation[contractObj.id]?.trim()}
                                >
                                  Submit Protest
                                </button>
                                <button
                                  style={{ ...navyBtnStyle, background: '#6b7280', fontSize: '12px' }}
                                  onClick={() => setProtestOpen((prev) => ({ ...prev, [contractObj.id]: false }))}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Government: View Protests */}
                      {userRole === 'government' && contractProtests.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <h6 style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: '13px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertCircle style={{ width: 14, height: 14 }} /> Filed Protests
                          </h6>
                          {contractProtests.map((protest) => (
                            <div key={protest.id} style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 6, padding: 10, marginBottom: 6, fontSize: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, color: '#991b1b' }}>{protest.category}</span>
                                <span style={{ ...badgeStyle, background: '#fee2e2', color: '#991b1b', fontSize: '10px' }}>{protest.status}</span>
                              </div>
                              <p style={{ color: '#374151', margin: 0, lineHeight: 1.4 }}>{protest.explanation}</p>
                              <span style={{ color: '#9ca3af', fontSize: '11px', marginTop: 4, display: 'block' }}>
                                Filed: {new Date(protest.filedAt).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Progress Bar (active / completed) */}
                  {(contractObj.status === 'active' || contractObj.status === 'completed') && (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Overall Progress</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f2942' }}>{contractObj.progress}%</span>
                        </div>
                        <div style={{ width: '100%', background: '#e5e7eb', borderRadius: 999, height: 6 }}>
                          <div style={{ width: `${contractObj.progress}%`, background: '#065f46', height: 6, borderRadius: 999, transition: 'width 0.3s' }} />
                        </div>
                      </div>

                      {/* Milestones */}
                      <div>
                        <h5 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f2942', marginBottom: 8 }}>Payment Milestones</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {contractObj.milestones.map((milestone: any) => (
                            <div
                              key={milestone.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: '#f9fafb',
                                border: '1px solid rgba(11,11,11,0.06)',
                                borderRadius: 8,
                                padding: '10px 14px',
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                  <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f2942' }}>{milestone.name}</span>
                                  {milestone.status === 'paid' && <CheckCircle style={{ width: 15, height: 15, color: '#065f46' }} />}
                                </div>
                                <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Banknote style={{ width: 13, height: 13 }} />
                                  {Number(milestone.amount).toLocaleString()} AFN
                                </span>
                              </div>
                              {milestone.status === 'pending' ? (
                                <button
                                  onClick={() => processMilestonePayment(contractObj.id, milestone.id)}
                                  style={navyBtnStyle}
                                >
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Shield style={{ width: 14, height: 14 }} /> Process Payment
                                  </span>
                                </button>
                              ) : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#065f46', fontWeight: 600, fontSize: '13px' }}>
                                  <CheckCircle style={{ width: 16, height: 16 }} /> Paid
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
