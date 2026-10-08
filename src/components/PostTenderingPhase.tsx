import { useState, useEffect } from 'react';
import { Award, CheckCircle, Banknote, Calendar, FileText, Shield, AlertCircle, Clock, Flag, ChevronDown, ChevronUp, Mail, Lock, Users, UserCheck } from 'lucide-react';
import { addProcurementRecordAsync, getOnChainBidId, recoverOnChainBidIdFromTx } from '../utils/blockchain';
import { sendWinnerNotificationEmail } from '../utils/emailNotify';
import { verifyRevealedBid } from '../utils/commitReveal';
import { verifyBusinessLicense, isAuthorizedDirector } from '../utils/committeeVerification';
import { setRoleSyncOverride } from '../utils/web3Provider';
import { useWeb3 } from '../utils/useWeb3';

interface PostTenderingPhaseProps {
  tenders: any[];
  bids: any[];
  setBids: (bids: any[]) => void;
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
  setUserRole: (role: 'citizen' | 'supplier' | 'government' | 'auditor' | 'oversight') => void;
  registeredSuppliers: any[];
  evaluationCommittees: any[];
  setEvaluationCommittees: (committees: any[]) => void;
  committeeAttestations: any[];
  setCommitteeAttestations: (attestations: any[]) => void;
  // Shared/persisted evaluation-outcome state — lifted to App.tsx and
  // synced through Firebase so every committee member's device sees the
  // same votes and the same stage, instead of each browser tab keeping its
  // own invisible copy. See the comment at their point of use below.
  evalStages: { [tenderId: string]: number };
  setEvalStages: (stages: { [tenderId: string]: number }) => void;
  memberEvalData: { [bidId: string]: { [memberName: string]: any } };
  setMemberEvalData: (data: { [bidId: string]: { [memberName: string]: any } }) => void;
  domesticFlags: { [bidId: string]: { isDomestic: boolean; domesticPreference: number } };
  setDomesticFlags: (flags: { [bidId: string]: { isDomestic: boolean; domesticPreference: number } }) => void;
  // Real save-confirmation state from the Firebase autosave — previously a
  // committee member checking a box had no way to know whether it actually
  // persisted. null = nothing changed yet this session.
  saveStatus: 'saving' | 'saved' | 'error' | null;
}

// What one committee member individually records for one bid — the raw
// judgment inputs only. Financial score, combined score, and the domestic
// preference flag live outside this (see EvalDatum below): financial is
// auto-computed from the bid amount (never a judgment call), and domestic
// status is an objective fact about the firm, not something that needs
// three independent opinions.
//
// Qualification criteria below match exactly what NPA's own Head of
// Procurement described as the actual scoring basis in practice — not a
// generic invented checklist: a valid business license (handled
// separately as an automatic registry check, not a checkbox here),
// cash/financial capacity for the project value, similar prior
// experience, and — for Services only — an implementation plan and staff
// CVs. (An equipment/machinery check for Works was considered but
// dropped — it wasn't part of what the official actually said, so it's
// not included here rather than invented.)
interface MemberEvalInput {
  preliminaryPass: boolean;
  bidSecurity: boolean;
  qualificationPass: boolean;
  similarExperience: boolean;
  financialCapacity: boolean;
  implementationPlan: boolean; // Services only
  staffCVs: boolean; // Services only
  technicalScore: number;
  // Whether this member has actually entered a Stage 2 technical score —
  // separate from technicalScore itself, because a member reaches Stage 1
  // (and so gets an entry in memberEvalData at all) before ever touching
  // Stage 2. Without this flag, an untouched technicalScore defaults to 0
  // and the committee average silently treated "hasn't scored yet" as "a
  // real score of zero," dragging the average down and showing "3/3
  // scored" when really only one member had entered anything.
  technicalScored: boolean;
}

const DEFAULT_MEMBER_EVAL: MemberEvalInput = {
  preliminaryPass: false,
  bidSecurity: false,
  qualificationPass: false,
  similarExperience: false,
  financialCapacity: false,
  implementationPlan: false,
  staffCVs: false,
  technicalScore: 0,
  technicalScored: false,
};

// The consolidated result for one bid — majority vote (2 of 3) on every
// pass/fail judgment, and the average of however many members have
// recorded a technical score and an experience-years figure. This is what
// ranking, award, and the RFQ clearance gate all read; no single member's
// input can determine the outcome alone.
interface EvalDatum extends MemberEvalInput {
  financialScore: number;
  combinedScore: number;
  isDomestic: boolean;
  domesticPreference: number;
  // How many members have actually entered a Stage 2 technical score —
  // distinct from membersScored below (which reflects Stage 1 checklist
  // activity and can already be 3/3 before anyone has touched Stage 2).
  technicalMembersScored: number;
  membersScored: number;
  totalMembers: number;
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

const STAGE_LABELS = ['Preliminary & Qualification', 'Technical Evaluation', 'Financial Evaluation', 'Combined Score & Ranking'];

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
  setBids,
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
  setUserRole,
  registeredSuppliers,
  evaluationCommittees,
  setEvaluationCommittees,
  evalStages,
  setEvalStages,
  memberEvalData,
  setMemberEvalData,
  domesticFlags,
  setDomesticFlags,
  saveStatus,
}: PostTenderingPhaseProps) {
  const [selectedTender, setSelectedTender] = useState<any>(null);
  // evalStages, memberEvalData and domesticFlags are shared/persisted state
  // (lifted to App.tsx and synced through Firebase, same as bids/tenders/
  // evaluationCommittees) — they record the committee's actual evaluation
  // outcome, which has to be visible across every member's own device, not
  // just whichever browser tab happened to enter it. Without that, separate
  // committee members on separate computers could never see each other's
  // votes, and a tender's stage would disagree from one device to the next.
  //
  // Once a tender's stage has been moved by hand (e.g. the committee went
  // back from an empty Stage 2 to revise their Stage 1 votes), the
  // automatic "everyone's done, advance" effect stops managing that
  // tender — otherwise it would immediately bounce them right back to
  // Stage 2 on the very next render, since nothing in memberEvalData
  // actually changed yet. From then on the manual "Complete Stage N"
  // button is what moves it forward again. This one stays local/per-device
  // — it's a navigation override, not an evaluation outcome.
  const [manualStageControl, setManualStageControl] = useState<{ [tenderId: string]: boolean }>({});
  // "Submit vote on-chain" used to give zero feedback either way — success
  // or failure looked identical (nothing happened). Keyed by
  // `${bidId}:${memberName}` since the same bid can be voted on by all 3
  // members independently. Local/per-device on purpose — it's transient
  // in-flight transaction status, not part of the evaluation record.
  const [voteStatus, setVoteStatus] = useState<{ [key: string]: { state: 'pending' | 'success' | 'error'; message?: string } }>({});
  // Stage 2's technical score used to commit to memberEvalData (and so
  // count toward the committee average) on every keystroke — a half-typed
  // number could briefly register as a member's "final" score if they
  // clicked away mid-edit. Kept as a local draft here instead; nothing
  // becomes part of the actual evaluation record until Submit is clicked.
  // Keyed by `${bidId}:${memberName}`, same as voteStatus above.
  const [technicalScoreDrafts, setTechnicalScoreDrafts] = useState<{ [key: string]: string }>({});
  const [expandedReports, setExpandedReports] = useState<{ [reportId: string]: boolean }>({});

  // Art. 3(18)/3(19): committee proposal draft (Procurement Official's input,
  // keyed by tenderId so switching between tenders doesn't lose a half-typed
  // proposal), and which member the current session is "acting as" when
  // recording an individual document attestation.
  // Wallet address fields are optional — the committee works exactly as
  // before (name-only, address bound later on first on-chain action) if
  // left blank. Filling in all three lets proposeCommittee mirror the
  // proposal on-chain immediately (the contract's proposeCommittee needs
  // real addresses up front, unlike the app-layer flow which can bind them
  // lazily), which is what actually makes voteOnBid/finalizeAward usable.
  const [committeeDraft, setCommitteeDraft] = useState<{ [tenderId: string]: { procurementMember: string; requestingDeptMember: string; otherDeptMember: string; procurementAddr: string; requestingAddr: string; otherAddr: string } }>({});
  const [actingAs, setActingAs] = useState<{ [tenderId: string]: string }>({});
  // Minister/Director is its own actable role for this workflow specifically
  // (not a 6th entry in the app's global wallet-verified role switcher —
  // that would need a matching on-chain Role.Director value to stay honest
  // about what's actually verified, which is a bigger, separate change).
  // Proposing and approving are gated to different values of this selector,
  // so "Approve" isn't just a differently-labeled button anyone can click —
  // it's unavailable unless the session is currently acting as the role
  // that's allowed to perform it.
  const [committeeActingRole, setCommitteeActingRole] = useState<{ [tenderId: string]: 'Procurement Official' | 'Minister/Director' }>({});
  // Wallet-binding: when a wallet is connected, propose/approve are tied to
  // the actual MetaMask address rather than just the "Acting as" label —
  // approval is refused if the same address that proposed tries to approve.
  // Without a connected wallet there's no real identity to check, so that
  // case is visibly flagged as unverified rather than silently trusted.
  const { connected: walletConnected, account: walletAccount, connect: connectWallet } = useWeb3();

  // Keep "Acting as" following whichever committee seat the connected
  // wallet is actually bound to, for every tender at once — instead of
  // leaving it on whatever name was last picked by hand. Without this,
  // switching MetaMask to a different committee member's wallet looked
  // like nothing happened: the dropdown stayed on the previous member,
  // and trying to vote as them just hit the wallet-mismatch warning.
  useEffect(() => {
    if (!walletConnected || !walletAccount) return;
    const addr = walletAccount.toLowerCase();
    evaluationCommittees.forEach((committee: any) => {
      const seat = committee.members?.find((m: any) => m.address?.toLowerCase() === addr);
      if (seat) {
        setActingAs((prev) => (prev[committee.tenderId] === seat.name ? prev : { ...prev, [committee.tenderId]: seat.name }));
      }
    });
  }, [walletConnected, walletAccount, evaluationCommittees]);

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

  // Feature 4: Detect tenders flagged for re-review via oversight complaints
  const flaggedForReReview = disputes
    .filter((d) => d.flaggedForReReview && d.routingDecision === 'evaluation_committee')
    .map((d) => ({ tenderId: d.relatedId, complaintId: d.id, complaintTitle: d.title }));
  const flaggedTenderIds = flaggedForReReview.map((f) => f.tenderId);

  const handleBeginReReview = async (tenderId: string, complaintId: string) => {
    // Reset evaluation stage to 1
    setEvalStages({ ...evalStages, [tenderId]: 1 });

    // Record on chain
    const { block, contract, onChain } = await addProcurementRecordAsync('evaluation_rereview', {
      tenderId,
      triggeredBy: complaintId,
    });

    setBlockchainRecords([...blockchainRecords, {
      id: block.hash,
      type: 'evaluation_rereview',
      tenderId,
      disputeId: complaintId,
      contractId: contract.id,
      transactionHash: contract.transactionHash,
      timestamp: new Date().toISOString(),
      verified: onChain,
      simulated: !onChain,
      onChain,
    }]);

    // Update dispute status
    setDisputes(disputes.map((d) =>
      d.id === complaintId ? { ...d, status: 'rereview_in_progress' } : d
    ));

    // Reset tender status if awarded/standstill
    setTenders(tenders.map((td) =>
      td.id === tenderId && (td.status === 'awarded' || td.status === 'standstill')
        ? { ...td, status: 'published' }
        : td
    ));

    // Suspend any contract for this tender
    setContracts(contracts.map((c) =>
      c.tenderId === tenderId && (c.status === 'active' || c.status === 'standstill')
        ? { ...c, status: 'suspended' }
        : c
    ));
  };

  const tendersWithBids = tenders.filter((td) => {
    const tenderBids = bids.filter((b) => b.tenderId === td.id);
    return tenderBids.length > 0 && (td.status === 'published' || td.status === 'standstill');
  });

  // All bids received for a tender, sealed or revealed — used for received
  // counts, never for evaluation math.
  const getAllTenderBids = (tenderId: string) => bids.filter((b) => b.tenderId === tenderId);

  // Bids with a usable price: Single-Source (nothing sealed) plus, for every
  // competitive method, only bids the bidder has actually revealed. A
  // committed-but-never-revealed bid has no verified amount to score or
  // compare and is excluded — that's the intended consequence of real
  // sealed bidding, not a bug.
  const getTenderBids = (tenderId: string) => {
    const tender = tenders.find((td) => td.id === tenderId);
    const all = getAllTenderBids(tenderId);
    if (tender?.method === 'Single-Source') return all;
    return all.filter((b) => b.revealed !== false);
  };

  // ── Evaluation Committee: Art. 3(18)/3(19)/23(1)-(2) ──────────────────
  // A Procurement Official proposes three named members (one per
  // department); a Minister/Director — a different actor than the
  // proposer — must separately approve before evaluation unlocks. This
  // replaces the single "Procuring Entity" user who previously did every
  // evaluation step alone.
  //
  // RFQ uses the same propose/approve/wallet-bound mechanism but it's a
  // different body with a different name and purpose: a Procurement
  // Inspection Committee that checks the quotation against specification
  // and price before award (not a multi-criteria bid evaluation) — so its
  // members are labeled "Inspection member", not "Evaluation member". The
  // three seats themselves (Procurement / Requesting Department / Other
  // Relevant Department) are the same across every method.
  const isInspectionCommittee = (method: string) => method === 'Request for Quotations';
  const committeeTypeName = (method: string) => isInspectionCommittee(method) ? 'Inspection Committee' : 'Evaluation Committee';
  const committeeDeptLabels = (_method: string) =>
    ({ procurement: 'Procurement', requesting: 'Requesting Department', other: 'Other Relevant Department' });

  const getCommittee = (tenderId: string) => evaluationCommittees.find((c) => c.tenderId === tenderId);

  const proposeCommittee = async (tenderId: string) => {
    // Guard here too, not just the disabled button — a UI bug shouldn't be
    // the only thing standing between "acting as the wrong role" and the
    // action actually happening.
    if ((committeeActingRole[tenderId] || 'Procurement Official') !== 'Procurement Official') return;
    const draft = committeeDraft[tenderId];
    if (!draft?.procurementMember?.trim() || !draft?.requestingDeptMember?.trim() || !draft?.otherDeptMember?.trim()) return;
    // Wallet addresses used to be genuinely optional — a seat left blank
    // would silently bind to whichever wallet acted first. That path is
    // gone now (bindMemberWallet refuses to bind an unbound seat at all),
    // so a seat proposed without an address can never be evaluated by
    // anyone, ever, until the committee is re-proposed. Requiring all
    // three up front here is what actually prevents that dead end, not
    // just the updated hint text below.
    if (!draft?.procurementAddr?.trim() || !draft?.requestingAddr?.trim() || !draft?.otherAddr?.trim()) return;
    const tender = tenders.find((td) => td.id === tenderId);
    const deptLabels = committeeDeptLabels(tender?.method || '');
    const addrs = [draft.procurementAddr?.trim() || null, draft.requestingAddr?.trim() || null, draft.otherAddr?.trim() || null];
    // Mirrors the contract's own distinctness check — three seats filled
    // with the same address would let one wallet single-handedly produce
    // a "2-of-3 majority," defeating the whole point of a committee.
    const nonEmptyAddrs = addrs.filter(Boolean).map((a) => a!.toLowerCase());
    if (new Set(nonEmptyAddrs).size !== nonEmptyAddrs.length) {
      alert('Committee seats must use distinct wallet addresses — the same address cannot fill more than one seat.');
      return;
    }
    const members = [
      // The Procurement Official only proposes who the three seats are —
      // the actual member isn't present to connect a wallet yet unless an
      // address was typed in directly. `address` stays null (and gets
      // bound later, see bindMemberWallet) when left blank — a name can
      // still be proposed freely either way.
      { name: draft.procurementMember.trim(), department: deptLabels.procurement, address: addrs[0] },
      { name: draft.requestingDeptMember.trim(), department: deptLabels.requesting, address: addrs[1] },
      { name: draft.otherDeptMember.trim(), department: deptLabels.other, address: addrs[2] },
    ];
    setEvaluationCommittees([
      ...evaluationCommittees.filter((c) => c.tenderId !== tenderId),
      {
        tenderId, members, status: 'proposed', proposedByRole: 'Procurement Official', proposedAt: new Date().toISOString(),
        // Captured only if a wallet is connected — there's no real identity
        // to bind to otherwise, and the approval step below knows how to
        // tell the difference between "no wallet was ever involved" and
        // "wallets were used but weren't actually distinct."
        proposedByAddress: walletConnected ? walletAccount : null,
      },
    ]);
    setCommitteeDraft((prev) => ({ ...prev, [tenderId]: { procurementMember: '', requestingDeptMember: '', otherDeptMember: '', procurementAddr: '', requestingAddr: '', otherAddr: '' } }));
    // A proposal's only next step is a Minister/Director approval — move
    // this screen's "Acting as" selector there immediately instead of
    // waiting for a wallet connect, so the approval controls (and the
    // "Connect Wallet to verify a distinct approver" link) are visible
    // right away.
    setCommitteeActingRole((prev) => ({ ...prev, [tenderId]: 'Minister/Director' }));

    // Mirror on-chain only when every seat has a real address — the
    // contract's proposeCommittee needs all three up front (unlike the
    // app-layer flow, which can bind addresses lazily as each member
    // first acts). Best-effort: a failure here doesn't block the
    // app-layer proposal above, same as every other on-chain call in this
    // app falling back to simulation.
    if (walletConnected && addrs.every(Boolean)) {
      try {
        await addProcurementRecordAsync('committee_propose', {
          tenderId,
          members: addrs as [string, string, string],
        });
      } catch (err) {
        console.error('[Committee] On-chain proposeCommittee failed, continuing app-layer only:', err);
      }
    }
  };

  const approveCommittee = async (tenderId: string) => {
    if (committeeActingRole[tenderId] !== 'Minister/Director') return;
    const committee = getCommittee(tenderId);
    if (walletConnected) {
      // Being "a different address than the proposer" isn't a real
      // authorization check on its own — anyone can create a second free
      // MetaMask address. The connected wallet must actually be on the
      // recognized Minister/Director allowlist to approve at all.
      if (!isAuthorizedDirector(walletAccount)) return;
      // Still refuse the degenerate case where the authorized address
      // somehow also proposed the same committee.
      if (committee?.proposedByAddress && walletAccount === committee.proposedByAddress) return;
    }
    const walletVerified = !!(
      walletConnected &&
      isAuthorizedDirector(walletAccount) &&
      (!committee?.proposedByAddress || walletAccount !== committee.proposedByAddress)
    );
    setEvaluationCommittees(
      evaluationCommittees.map((c) => (c.tenderId === tenderId ? {
        ...c,
        status: 'approved',
        approvedByRole: 'Minister/Director',
        approvedByAddress: walletConnected ? walletAccount : null,
        approvedAt: new Date().toISOString(),
        walletVerified,
      } : c))
    );
    // The Minister/Director's job for this tender ends at approval — hand
    // this screen, and the whole app, back to the Procuring Entity so the
    // same session can immediately continue into bid evaluation by the
    // committee, rather than leaving "Minister/Director" selected or the
    // top banner wherever the approver's wallet happened to land it.
    setCommitteeActingRole((prev) => ({ ...prev, [tenderId]: 'Procurement Official' }));
    setRoleSyncOverride(null);
    setUserRole('government');

    // Mirror on-chain — only meaningful if proposeCommittee above already
    // registered this committee on-chain (i.e. all three addresses were
    // known at propose time). Best-effort, same as every other on-chain
    // call in this app.
    if (walletConnected && committee?.members?.every((m: any) => m.address)) {
      try {
        await addProcurementRecordAsync('committee_approve', { tenderId });
      } catch (err) {
        console.error('[Committee] On-chain approveCommittee failed, continuing app-layer only:', err);
      }
    }
  };

  // A member's identity is bound to whichever wallet is connected the first
  // time they ever act (attest OR evaluate) — not typed, not re-typeable.
  // Without this, one person could switch the "Acting as" dropdown through
  // all three names (nothing else distinguishes them) and manufacture a
  // fake 2-of-3 majority single-handedly, which defeats the entire point of
  // requiring three independent members. Returns false (refusing the
  // action) if this wallet already claimed a different seat on the same
  // committee, or if this seat is already bound to a different wallet than
  // the one connected right now.
  const bindMemberWallet = (tenderId: string, memberName: string): boolean => {
    if (!walletConnected) return true; // unverified/simulated mode — no binding to check
    const committee = getCommittee(tenderId);
    if (!committee) return true;
    const member = committee.members.find((m: any) => m.name === memberName);
    if (!member) return true;
    const addr = walletAccount?.toLowerCase();
    // The Minister/Director's own approval wallet must never also act as
    // an evaluator — separation of duties, and the exact real incident
    // that prompted this: that wallet once ended up lazily self-bound to
    // a Procurement seat on an earlier tender, meaning the same address
    // both approved the committee AND could vote as one of its members.
    // Blocked unconditionally here, whether the seat is already bound to
    // this address (pre-existing bad data) or still open.
    if (isAuthorizedDirector(walletAccount)) return false;
    if (member.address && member.address.toLowerCase() !== addr) return false;
    const claimedByAnotherSeat = committee.members.some(
      (m: any) => m.name !== memberName && m.address?.toLowerCase() === addr
    );
    if (claimedByAnotherSeat) return false;
    // A seat with no address assigned yet no longer silently claims
    // whichever wallet clicks it first — that lazy-binding path is
    // exactly how the Director's wallet above ended up double-seated as
    // an evaluator in the first place. A seat now stays closed to every
    // wallet until a Procurement Official explicitly assigns it a real
    // address (propose/re-propose committee) — full stop, no exceptions.
    if (!member.address) return false;
    return true;
  };

  // Why a checkbox click for this member might currently do nothing —
  // surfaced as text instead of the silent no-op bindMemberWallet otherwise
  // produces, which looked identical to a broken checkbox. Covers both: the
  // seat is already bound to a different wallet than the one connected now,
  // AND the wallet connected now is already bound to a DIFFERENT seat on
  // this same committee (the case that blocks a second/third member from
  // ever getting their first click to register if the same wallet was used
  // to act as an earlier member first).
  const getSeatBlockReason = (tenderId: string, memberName: string): string | null => {
    if (!walletConnected) return null;
    const committee = getCommittee(tenderId);
    if (!committee) return null;
    const seat = committee.members.find((m: any) => m.name === memberName);
    if (!seat) return null;
    const addr = walletAccount?.toLowerCase();
    const CANNOT_EVALUATE_MSG = 'You can only evaluate if you are a committee member from Procurement, Requesting Department, or Other Relevant Department.';
    if (isAuthorizedDirector(walletAccount)) {
      return `${CANNOT_EVALUATE_MSG} This wallet is the registered Minister/Director approval authority — it cannot also cast an evaluator's vote (separation of duties).`;
    }
    if (seat.address && seat.address.toLowerCase() !== addr) {
      return `Your connected wallet doesn't match ${memberName}'s bound address (${seat.address.slice(0, 6)}…${seat.address.slice(-4)}) — checkbox clicks won't register until you switch MetaMask to that wallet.`;
    }
    const claimedByAnotherSeat = committee.members.find(
      (m: any) => m.name !== memberName && m.address?.toLowerCase() === addr
    );
    if (claimedByAnotherSeat) {
      return `Your connected wallet is already bound to ${claimedByAnotherSeat.name}'s seat on this committee — switch to a different MetaMask account to act as ${memberName} (one wallet can't vote for two committee members).`;
    }
    if (!seat.address) {
      return `${CANNOT_EVALUATE_MSG} ${memberName}'s seat has no wallet assigned yet — ask the Procurement Official to assign a real address to it (propose/re-propose the committee) before evaluation can begin here.`;
    }
    return null;
  };

  // True only when the connected wallet IS the specific address bound to
  // this seat (same rule getSeatBlockReason enforces, just as a plain
  // boolean). Used to gate the "Wallet: 0x…" badge next to Acting-as — it
  // should show that member's own address being live, never whatever
  // wallet merely happens to be connected while a different member is
  // selected.
  const isSeatWallet = (tenderId: string, memberName: string): boolean => {
    if (!walletConnected || !walletAccount || isAuthorizedDirector(walletAccount)) return false;
    const seat = getCommittee(tenderId)?.members.find((m: any) => m.name === memberName);
    return !!seat?.address && seat.address.toLowerCase() === walletAccount.toLowerCase();
  };

  // Real save-confirmation for the evaluation checklist/score entry —
  // checking a box used to give no feedback at all about whether it
  // actually reached Firebase (a dropped connection would silently lose
  // it). saveStatus reflects the app's one shared autosave, so this
  // necessarily describes the save state of everything, not just this
  // one field — still the only accurate signal available, better than the
  // previous silence.
  const renderSaveIndicator = () => {
    if (!saveStatus) return null;
    if (saveStatus === 'saving') {
      return <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>Saving…</span>;
    }
    if (saveStatus === 'error') {
      return <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>⚠ Your last change may not have been saved — check your connection</span>;
    }
    return <span style={{ fontSize: '11px', color: '#065f46', fontWeight: 600 }}>✓ All changes saved</span>;
  };

  // "{member}: X/Y bids checked" (or "scored", for Stage 2) next to the
  // Acting-as selector — the single glance-able answer to "am I actually
  // done before I switch to the next member," instead of having to scroll
  // through every bid card's own counter individually.
  const renderMemberProgress = (tenderId: string, currentActor: string, bidIds: string[], kind: 'checked' | 'scored') => {
    if (!currentActor || bidIds.length === 0) return null;
    const done = bidIds.filter((bidId) => {
      const mine = getMemberEvalDatum(bidId, currentActor);
      return kind === 'scored' ? mine.technicalScored : !!memberEvalData[bidId]?.[currentActor];
    }).length;
    const complete = done === bidIds.length;
    return (
      <span style={{ fontSize: '11px', fontWeight: 600, color: complete ? '#065f46' : '#b45309' }}>
        {complete ? '✓ ' : ''}{currentActor}: {done}/{bidIds.length} bid{bidIds.length === 1 ? '' : 's'} {kind}
        {!complete ? ' — not done yet' : ''}
      </span>
    );
  };

  const getMemberEvalDatum = (bidId: string, memberName: string): MemberEvalInput =>
    memberEvalData[bidId]?.[memberName] || DEFAULT_MEMBER_EVAL;

  const updateMemberEvalDatum = (tenderId: string, bidId: string, memberName: string, partial: Partial<MemberEvalInput>) => {
    if (!bindMemberWallet(tenderId, memberName)) return;
    const merged: MemberEvalInput = { ...getMemberEvalDatum(bidId, memberName), ...partial };

    // Preliminary/Qualification Pass used to be separate manual checkboxes
    // a member had to remember to ALSO tick after reviewing the individual
    // evidence boxes above them — ticking every evidence box looked
    // complete but still silently counted as a Fail vote if that one extra
    // click was missed (confirmed happening: a member checked "Bid
    // Security attached" but the separate Preliminary summary box stayed
    // unchecked, so their vote read as Fail despite the evidence being
    // marked reviewed). Now auto-derived directly from the evidence boxes
    // themselves — there's no separate step left to forget.
    const bid = bids.find((b) => b.id === bidId);
    const tender = tenders.find((td) => td.id === tenderId);
    // RFQ's Inspection Committee has no sub-criteria layer at all — its one
    // "Meets specification" checkbox IS the direct vote (Rule 19(7)), not a
    // summary derived from anything else. Auto-deriving would silently
    // overwrite that explicit click, so this method is excluded.
    if (tender?.method !== 'Request for Quotations') {
      const isServicesTender = (tender?.procurementType || 'Goods') === 'Services';
      const license = verifyBusinessLicense(bid?.vendorName, registeredSuppliers);
      merged.preliminaryPass = !!merged.bidSecurity;
      merged.qualificationPass = !!(
        merged.similarExperience &&
        merged.financialCapacity &&
        (!isServicesTender || (merged.implementationPlan && merged.staffCVs)) &&
        license.verified
      );
    }

    setMemberEvalData((prev) => ({
      ...prev,
      [bidId]: { ...(prev[bidId] || {}), [memberName]: merged },
    }));
  };

  const setDomesticFlag = (bidId: string, isDomestic: boolean) => {
    setDomesticFlags((prev) => ({ ...prev, [bidId]: { isDomestic, domesticPreference: isDomestic ? 25 : 0 } }));
  };

  // Mirrors a member's current preliminary/qualification judgment on-chain
  // via voteOnBid — a deliberate, explicit action (not fired on every
  // checkbox click, which would pop a wallet signature prompt per
  // keystroke). Only meaningful once this member's wallet is bound and the
  // bid was committed/revealed on-chain; silently skipped otherwise.
  const submitVoteOnChain = async (tenderId: string, bidId: string, memberName: string) => {
    if (!walletConnected) return;
    const committee = getCommittee(tenderId);
    const member = committee?.members.find((m: any) => m.name === memberName);
    if (!member?.address || member.address.toLowerCase() !== walletAccount?.toLowerCase()) return;
    const key = `${bidId}:${memberName}`;
    const bid = bids.find((b) => b.id === bidId);
    const tender = tenders.find((td) => td.id === tenderId);
    let onChainBidId = bid?.onChainBidId as string | undefined;
    let onChainTenderId = (bid?.onChainTenderId || tender?.onChainTenderId) as string | undefined;
    setVoteStatus((prev) => ({ ...prev, [key]: { state: 'pending' } }));

    // A bid can only be voted on on-chain if it was genuinely committed
    // on-chain in the first place — most bids submitted while
    // disconnected (Simulation Mode) never were, and no amount of
    // recovery fixes that; there's nothing on-chain to reference. But a
    // bid that WAS committed on-chain before onChainBidId persistence
    // existed in this app still has a real BidCommitted event sitting on
    // the chain right now — its commit transaction hash is already saved
    // in blockchainRecords, so recover the ID directly from that
    // transaction instead of treating "never captured it the first time"
    // as unrecoverable.
    if (!onChainBidId) {
      const commitRecord = blockchainRecords.find((r) => r.bidId === bidId && r.type === 'bid_submitted' && r.onChain && r.transactionHash);
      if (commitRecord) {
        try {
          const recovered = await recoverOnChainBidIdFromTx(commitRecord.transactionHash);
          if (recovered?.onChainBidId) {
            onChainBidId = recovered.onChainBidId;
            onChainTenderId = recovered.onChainTenderId || onChainTenderId;
            setBids(bids.map((b) => (b.id === bidId ? { ...b, onChainBidId, onChainTenderId } : b)));
          }
        } catch (err) {
          console.error('[Committee] Failed to recover on-chain bid ID from commit tx:', err);
        }
      }
    }

    if (!onChainBidId) {
      setVoteStatus((prev) => ({ ...prev, [key]: { state: 'error', message: 'This bid was never committed on-chain (it was submitted without a wallet connected), so there is nothing on-chain to vote on.' } }));
      return;
    }
    const mine = getMemberEvalDatum(bidId, memberName);
    // Rule 19(7) RFQ has exactly one gate — "meets specification" — not
    // the separate preliminary/qualification pair the multi-stage methods
    // use. The contract's Vote struct still has two fields regardless
    // (isBidQualified requires prelimYes>=2 AND qualYes>=2 for every
    // method, no exception for RFQ), so an RFQ vote has to answer both to
    // ever actually satisfy it on-chain. Without this, qualificationPass
    // stayed permanently false for every RFQ vote (RFQ's UI never shows or
    // sets it), isBidQualified could never return true for any RFQ bid,
    // and finalizeAward always reverted with "No qualified revealed bid" —
    // silently caught and quietly falling back to a simulated award, so
    // no RFQ award has ever actually existed on-chain despite the UI
    // showing success.
    const isRFQTender = tender?.method === 'Request for Quotations';
    const qualificationPassForChain = isRFQTender ? mine.preliminaryPass : mine.qualificationPass;
    try {
      const { block, contract, success, onChain } = await addProcurementRecordAsync('committee_vote', {
        tenderId,
        bidId,
        preliminaryPass: mine.preliminaryPass,
        qualificationPass: qualificationPassForChain,
        onChainBidId,
        onChainTenderId,
      });
      // Previously this result was discarded after updating voteStatus —
      // voteStatus is local/per-device, so nobody except the browser tab
      // that just submitted ever saw confirmation a vote went on-chain.
      // Recording it into blockchainRecords (shared/persisted like every
      // other on-chain action) gives the rest of the app — and this same
      // member coming back later, on any device — a durable "✓ Voted
      // on-chain" fact to read instead of nothing.
      if (success) {
        setBlockchainRecords([...blockchainRecords, {
          id: block.hash,
          type: 'committee_vote',
          tenderId,
          bidId,
          memberName,
          memberAddress: walletAccount,
          preliminaryPass: mine.preliminaryPass,
          qualificationPass: qualificationPassForChain,
          contractId: contract.id,
          transactionHash: contract.transactionHash,
          timestamp: new Date().toISOString(),
          verified: onChain,
          simulated: !onChain,
          onChain,
        }]);
      }
      setVoteStatus((prev) => ({ ...prev, [key]: { state: 'success' } }));
    } catch (err: any) {
      console.error('[Committee] On-chain voteOnBid failed:', err);
      setVoteStatus((prev) => ({ ...prev, [key]: { state: 'error', message: err?.reason || err?.message || 'Transaction failed — check your wallet.' } }));
    }
  };

  // Durable, shared answer to "has this member already voted on-chain for
  // this bid?" — reads blockchainRecords (persisted) instead of voteStatus
  // (local/per-device, gone the moment the tab that submitted it closes).
  const hasVotedOnChain = (bidId: string, memberName: string): boolean =>
    blockchainRecords.some((r) => r.type === 'committee_vote' && r.bidId === bidId && r.memberName === memberName && r.onChain);

  const getCurrentStage = (tenderId: string): number => evalStages[tenderId] || 1;

  const advanceStage = (tenderId: string) => {
    const current = getCurrentStage(tenderId);
    if (current < 4) {
      setEvalStages((prev) => ({ ...prev, [tenderId]: current + 1 }));
    }
  };

  // Lets the committee step back to revise an earlier stage's votes — e.g.
  // Stage 1 auto-advances as soon as all three members have recorded a
  // judgment, even when that judgment disqualifies every bid, leaving
  // Stage 2/3/4 with nothing left to evaluate and no way forward. Nothing
  // entered in memberEvalData is cleared by moving back; members just see
  // their own checkboxes again and can change them.
  const goToStage = (tenderId: string, stage: number) => {
    setEvalStages((prev) => ({ ...prev, [tenderId]: stage }));
    setManualStageControl((prev) => ({ ...prev, [tenderId]: true }));
  };

  // Majority (2 of 3) on both pass/fail gates, counting only members
  // actually seated on this tender's committee. Kept separate from
  // getEvalDatum (which also computes financial/combined score) so
  // computeAutoFinancialScore — which needs to know which OTHER bids
  // qualify — doesn't have to pull in the full consolidated object for
  // every bid just to read two booleans.
  const isBidQualified = (tenderId: string, bidId: string): boolean => {
    const committee = getCommittee(tenderId);
    if (!committee) return false;
    const memberNames: string[] = committee.members.map((m: any) => m.name);
    const inputs = memberNames.map((n) => memberEvalData[bidId]?.[n]).filter(Boolean) as MemberEvalInput[];
    if (inputs.length === 0 || memberNames.length === 0) return false;
    const majority = (pred: (i: MemberEvalInput) => boolean) =>
      inputs.filter(pred).length >= Math.ceil(memberNames.length / 2);
    return majority((i) => i.preliminaryPass) && majority((i) => i.qualificationPass);
  };

  // Rule 72(2): lowest-priced qualified bid scores 100 points; others score
  // proportionally down from it (lowestAmount / thisAmount * 100). Applied
  // here to every method's financial component (not just QCBS) so the price
  // score can never be hand-typed by an evaluator — it is derived only from
  // the bid amount actually submitted.
  const computeAutoFinancialScore = (tenderId: string, bidId: string): number => {
    const tenderBids = getTenderBids(tenderId);
    const qualifiedAmounts = tenderBids
      .filter((b) => isBidQualified(tenderId, b.id))
      .map((b) => Number(b.amount))
      .filter((a) => a > 0);
    if (qualifiedAmounts.length === 0) return 0;
    const lowestAmount = Math.min(...qualifiedAmounts);
    const bid = tenderBids.find((b) => b.id === bidId);
    const thisAmount = Number(bid?.amount) || 0;
    if (thisAmount <= 0) return 0;
    return Math.round((lowestAmount / thisAmount) * 10000) / 100;
  };

  // The consolidated result everything else (ranking, award, RFQ clearance,
  // reports) reads: majority vote on every pass/fail judgment, the average
  // of however many members have scored technical/experience so far, and
  // the resulting financial/combined score. Nothing here is stored — it's
  // recomputed live from memberEvalData on every read, so there's no
  // separate "finalize" step that could drift out of sync with what
  // members actually entered.
  const getEvalDatum = (bidId: string): EvalDatum => {
    const bid = bids.find((b) => b.id === bidId);
    const tenderId = bid?.tenderId as string | undefined;
    const tender = tenderId ? tenders.find((td) => td.id === tenderId) : undefined;
    const committee = tenderId ? getCommittee(tenderId) : undefined;
    const memberNames: string[] = committee?.members.map((m: any) => m.name) || [];
    const inputs = memberNames.map((n) => memberEvalData[bidId]?.[n]).filter(Boolean) as MemberEvalInput[];
    const totalMembers = memberNames.length;
    const membersScored = inputs.length;

    const majority = (pred: (i: MemberEvalInput) => boolean) =>
      totalMembers > 0 && inputs.filter(pred).length >= Math.ceil(totalMembers / 2);

    const domestic = domesticFlags[bidId] || { isDomestic: false, domesticPreference: 0 };
    const preliminaryPass = majority((i) => i.preliminaryPass);
    const qualificationPass = majority((i) => i.qualificationPass);
    // Average only over members who have actually entered a Stage 2 score
    // — an untouched member's technicalScore defaults to 0, which used to
    // get silently averaged in as if it were a real score of zero the
    // moment that member had ANY memberEvalData entry (e.g. from Stage 1),
    // dragging the committee average down before Stage 2 was even started.
    const technicalInputs = inputs.filter((i) => i.technicalScored);
    const technicalMembersScored = technicalInputs.length;
    const technicalScore = technicalMembersScored
      ? Math.round((technicalInputs.reduce((sum, i) => sum + i.technicalScore, 0) / technicalMembersScored) * 100) / 100
      : 0;

    let financialScore = 0;
    let combinedScore = 0;
    if (tenderId && preliminaryPass && qualificationPass) {
      financialScore = computeAutoFinancialScore(tenderId, bidId);
      const adjustedFinancial = Math.min(100, financialScore + domestic.domesticPreference);
      const procType = tender?.procurementType || 'Goods';
      // QCBS (Services): 70% technical + 30% financial — Art. 22(6).
      // Goods/Works: Lowest Evaluated Bid — financial primary, technical
      // qualifier — Art. 22(5).
      combinedScore = procType === 'Services'
        ? Math.round((technicalScore * 0.7 + adjustedFinancial * 0.3) * 100) / 100
        : Math.round((technicalScore * 0.3 + adjustedFinancial * 0.7) * 100) / 100;
    }

    return {
      preliminaryPass,
      bidSecurity: majority((i) => i.bidSecurity),
      qualificationPass,
      similarExperience: majority((i) => i.similarExperience),
      financialCapacity: majority((i) => i.financialCapacity),
      implementationPlan: majority((i) => i.implementationPlan),
      staffCVs: majority((i) => i.staffCVs),
      technicalScore,
      // True once every seated member has scored — marks the consolidated
      // technicalScore above as final rather than a provisional partial
      // average.
      technicalScored: totalMembers > 0 && technicalMembersScored === totalMembers,
      technicalMembersScored,
      financialScore,
      combinedScore,
      isDomestic: domestic.isDomestic,
      domesticPreference: domestic.domesticPreference,
      membersScored,
      totalMembers,
    };
  };

  // Auto-advance Stage 1 → Stage 2 once every seated committee member has
  // recorded a preliminary + qualification checklist entry for every bid
  // on this tender — the same condition the manual "Complete Stage 1"
  // button relies on, just acted on automatically instead of waiting for
  // someone to notice all three members are done and click it. Scoped to
  // the multi-stage flow only (Open/Restricted Bidding, approved
  // committee) since RFQ and Single-Source tenders never advance through
  // evalStages at all.
  useEffect(() => {
    tenders.forEach((tender) => {
      if (tender.method === 'Request for Quotations' || tender.method === 'Single-Source') return;
      if (getCurrentStage(tender.id) !== 1) return;
      if (manualStageControl[tender.id]) return;
      const committee = getCommittee(tender.id);
      if (!committee || committee.status !== 'approved' || !committee.members?.length) return;
      const tenderBids = getTenderBids(tender.id);
      if (tenderBids.length === 0) return;
      const allBidsFullyEvaluated = tenderBids.every((bid) => {
        const datum = getEvalDatum(bid.id);
        return datum.totalMembers > 0 && datum.membersScored >= datum.totalMembers;
      });
      if (allBidsFullyEvaluated) {
        advanceStage(tender.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenders, bids, memberEvalData, evaluationCommittees, evalStages, manualStageControl]);

  const getRankedBids = (tenderId: string) => {
    const tenderBids = getTenderBids(tenderId);
    return tenderBids
      .filter((bid) => {
        const d = getEvalDatum(bid.id);
        return d.preliminaryPass && d.qualificationPass;
      })
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
    // Single-source contracts are exempt from the standstill/objection period —
    // Art. 43(4): "Single-source contracts are not subjected to this article."
    const isSingleSource = tender.method === 'Single-Source';
    const isRFQ = tender.method === 'Request for Quotations';
    // Belt-and-suspenders guard matching the Stage 4 button, which is
    // already hidden/disabled in this exact situation — Technical
    // Evaluation must be genuinely complete (all 3 members scored) before
    // a combined-score ranking can be trusted enough to award on. RFQ and
    // Single-Source never go through Stage 2 at all, so this never applies
    // to them.
    if (!isSingleSource && !isRFQ && !datum.technicalScored) {
      console.warn(`[Award] Blocked — only ${datum.technicalMembersScored}/${datum.totalMembers} members have entered a technical score for ${bid.id}.`);
      return;
    }

    // finalizeAward computes the winner itself on-chain — it takes no
    // vendor/amount/bidId input, so the only way to know whether the chain
    // actually agreed with this screen's own pick is to read back which
    // bid it reports as the winner and compare. The app's bid objects are
    // identified by company name, not wallet address, so the only
    // reliable bridge is the on-chain bid ID this exact `bid` was cached
    // under at commit/submit time (see getOnChainBidId).
    let recordResult: Awaited<ReturnType<typeof addProcurementRecordAsync>> | null = null;
    if (!isSingleSource && walletConnected) {
      try {
        const result = await addProcurementRecordAsync('award', { tenderId: tender.id });
        if (result.onChain) {
          const expectedOnChainBidId = getOnChainBidId(bid.id);
          const actualOnChainBidId = result.contract?.data?.onChainBidId;
          if (actualOnChainBidId && expectedOnChainBidId && actualOnChainBidId !== expectedOnChainBidId) {
            alert(
              `On-chain finalization picked a different winner than this screen's evaluation (on-chain bid ${actualOnChainBidId} vs. the selected ${bid.vendorName}). ` +
              `This usually means not all committee votes were cast on-chain yet, or an on-chain bid wasn't revealed. ` +
              `Refusing to award the wrong party — check on-chain votes before retrying.`
            );
            return;
          }
        }
        recordResult = result;
      } catch (err) {
        console.error('[Award] On-chain finalizeAward failed, falling back to simulated award:', err);
      }
    }
    if (!recordResult) {
      recordResult = await addProcurementRecordAsync('award', {
        tenderId: tender.id,
        bidderId: bid.id,
        amount: bid.amount,
        vendor: bid.vendorName,
      });
    }
    return awardContractRecord(tender, bid, datum, recordResult);
  };

  // The actual app-layer contract-record bookkeeping — takes the already-
  // performed blockchain record (on-chain finalizeAward result, or the
  // simulated fallback) rather than making its own call, so finalizeAward
  // is never invoked twice for the same tender.
  const awardContractRecord = async (tender: any, bid: any, datum: EvalDatum, recordResult: Awaited<ReturnType<typeof addProcurementRecordAsync>>) => {
    const isSingleSource = tender.method === 'Single-Source';
    const newContract = {
      id: `CNT-${Date.now()}`,
      tenderId: tender.id,
      tenderTitle: tender.title,
      bidId: bid.id,
      vendorName: bid.vendorName,
      vendorEmail: bid.vendorEmail,
      amount: bid.amount,
      timeline: bid.timeline,
      status: isSingleSource ? 'active' : 'standstill',
      awardDecisionDate: new Date().toISOString(),
      standstillEndDate: isSingleSource ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      standstillExempt: isSingleSource,
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

    const { block, contract, onChain } = recordResult;

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
      td.id === tender.id ? { ...td, status: isSingleSource ? 'awarded' : 'standstill' } : td
    );

    const emailResult = await sendWinnerNotificationEmail({
      vendorEmail: bid.vendorEmail,
      vendorName: bid.vendorName,
      tenderTitle: tender.title,
      amount: bid.amount,
      contractId: newContract.id,
    });

    setContracts([...contracts, { ...newContract, emailNotification: emailResult.status }]);
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

  const renderCommitteeSection = (tender: any) => {
    const committee = getCommittee(tender.id);
    const draft = committeeDraft[tender.id] || { procurementMember: '', requestingDeptMember: '', otherDeptMember: '', procurementAddr: '', requestingAddr: '', otherAddr: '' };
    const actingRole = committeeActingRole[tender.id] || 'Procurement Official';
    const isInspection = isInspectionCommittee(tender.method);
    const typeName = committeeTypeName(tender.method);
    const deptLabels = committeeDeptLabels(tender.method);
    const sameWalletConflict = committee?.status === 'proposed' && walletConnected && committee?.proposedByAddress && walletAccount === committee.proposedByAddress;
    const notAuthorizedDirector = committee?.status === 'proposed' && walletConnected && !isAuthorizedDirector(walletAccount);
    // Only auto-select "Minister/Director" when connecting from the
    // pending-approval screen, where that's unambiguously why someone would
    // connect a wallet here. On the propose screen, connecting shouldn't
    // silently flip the role away from Procurement Official.
    // The badge below used to show whatever wallet was merely connected,
    // regardless of whether it actually meant anything for the role
    // currently selected here — so an evaluator's wallet (Procurement/
    // Requesting Dept/Other Dept) showed up looking like it was somehow
    // the Minister/Director's or Procurement Official's own address. Same
    // fix as the evaluation screens: show it only when the connected
    // wallet IS that role's real associated account — the Director's
    // allowlisted address for Minister/Director, or whoever actually
    // proposed this committee for Procurement Official (any wallet may
    // propose a committee that doesn't exist yet, so there's nothing to
    // match against until one has).
    const roleWalletMatches = actingRole === 'Minister/Director'
      ? isAuthorizedDirector(walletAccount)
      : (!committee?.proposedByAddress || walletAccount?.toLowerCase() === committee.proposedByAddress.toLowerCase());
    const renderRoleSelector = (autoSelectOnConnect?: 'Minister/Director') => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#78350f' }}>Acting as:</span>
        <select
          value={actingRole}
          onChange={(e) => setCommitteeActingRole((prev) => ({ ...prev, [tender.id]: e.target.value as 'Procurement Official' | 'Minister/Director' }))}
          style={{ fontSize: '12px', padding: '4px 8px', borderRadius: 6, border: '1px solid #fcd34d' }}
        >
          <option value="Procurement Official">Procurement Official</option>
          <option value="Minister/Director">Minister/Director</option>
        </select>
        {walletConnected && roleWalletMatches ? (
          <span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: '#065f46', background: '#d1fae5', padding: '2px 8px', borderRadius: 999 }}>
            Wallet: {walletAccount?.slice(0, 6)}…{walletAccount?.slice(-4)}
          </span>
        ) : walletConnected ? (
          // Already connected, just not with the right wallet for this
          // role — clicking "Connect Wallet" again here is a no-op
          // (eth_requestAccounts silently returns the same
          // already-authorized account; it does not reopen MetaMask's
          // picker). A button that can't do anything is worse than no
          // button, so this shows accurate static guidance instead.
          <span style={{ fontSize: '11px', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: 999 }}>
            Connected wallet ({walletAccount?.slice(0, 6)}…{walletAccount?.slice(-4)}) isn't {actingRole === 'Minister/Director' ? 'the authorized Director address' : 'the address that proposed this committee'} — switch accounts inside MetaMask itself.
          </span>
        ) : (
          <button
            type="button"
            onClick={async () => {
              // Connecting here is to verify an approval address, not to
              // navigate the app — tell the global role-sync effect to land
              // back on Procuring Entity afterward instead of whatever this
              // wallet happens to be registered as on-chain.
              setRoleSyncOverride('government');
              await connectWallet();
              if (autoSelectOnConnect) {
                setCommitteeActingRole((prev) => ({ ...prev, [tender.id]: autoSelectOnConnect }));
              }
            }}
            style={{ fontSize: '11px', fontWeight: 700, color: '#1c5cab', background: 'none', border: '1px solid #bcd6f5', borderRadius: 999, padding: '2px 8px', cursor: 'pointer' }}
          >
            Connect Wallet to verify a distinct approver
          </button>
        )}
      </div>
    );

    if (!committee) {
      const canPropose = actingRole === 'Procurement Official';
      return (
        <div style={{ ...cardStyle, marginBottom: 16, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Users style={{ width: 15, height: 15, color: '#92400e' }} />
            <h5 style={{ fontSize: '13.5px', fontWeight: 700, color: '#92400e', margin: 0 }}>
              {isInspection ? 'Propose Procurement Inspection Committee' : 'Propose Evaluation Committee (Art. 3(18)/3(19))'}
            </h5>
          </div>
          <p style={{ fontSize: '12px', color: '#78350f', marginBottom: 10 }}>
            {isInspection
              ? 'At least three members verify the quotation against specification and price before award. Only the Procurement Official role can propose members. A Minister/Director — switch the selector below — must separately approve before inspection can start; the same session can hold either role but not act as both for the same step.'
              : 'Only the Procurement Official role can propose members. A Minister/Director — switch the selector below — must separately approve before evaluation can start; the same session can hold either role but not act as both for the same step.'}
          </p>
          {renderRoleSelector()}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 6, opacity: canPropose ? 1 : 0.5 }}>
            {([
              ['procurementMember', 'procurementAddr', `${deptLabels.procurement} ${isInspection ? 'inspection ' : ''}member`],
              ['requestingDeptMember', 'requestingAddr', `${deptLabels.requesting} ${isInspection ? 'inspection ' : ''}member`],
              ['otherDeptMember', 'otherAddr', `${deptLabels.other} ${isInspection ? 'inspection ' : ''}member`],
            ] as const).map(([key, addrKey, label]) => (
              <div key={key}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#78350f', display: 'block', marginBottom: 3 }}>{label}</label>
                <input
                  type="text"
                  disabled={!canPropose}
                  value={draft[key]}
                  onChange={(e) => setCommitteeDraft((prev) => ({ ...prev, [tender.id]: { ...draft, [key]: e.target.value } }))}
                  placeholder="Full name"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #fcd34d', fontSize: '12.5px', marginBottom: 4 }}
                />
                <input
                  type="text"
                  disabled={!canPropose}
                  value={draft[addrKey]}
                  onChange={(e) => setCommitteeDraft((prev) => ({ ...prev, [tender.id]: { ...draft, [addrKey]: e.target.value } }))}
                  placeholder="0x… wallet (required)"
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${draft[addrKey]?.trim() ? '#fcd34d' : '#fca5a5'}`, fontSize: '11px', fontFamily: 'ui-monospace, monospace' }}
                />
              </div>
            ))}
          </div>
          <p style={{ fontSize: '10.5px', color: '#9ca3af', marginBottom: 10 }}>
            Wallet address is required for all three seats — a seat left blank can never be evaluated by anyone (checkbox clicks won't register for it, no matter who connects). Filling these in also lets this committee be mirrored on-chain immediately (needed for on-chain voting and award finalization).
          </p>
          {(() => {
            const allAddrsFilled = !!(draft.procurementAddr?.trim() && draft.requestingAddr?.trim() && draft.otherAddr?.trim());
            const canSubmit = canPropose && allAddrsFilled;
            return (
              <button
                onClick={() => proposeCommittee(tender.id)}
                disabled={!canSubmit}
                title={!canPropose ? 'Switch "Acting as" to Procurement Official to propose a committee' : !allAddrsFilled ? 'All three wallet addresses are required before a committee can be proposed' : undefined}
                style={{ ...navyBtnStyle, background: canSubmit ? '#92400e' : '#d1d5db', fontSize: '12.5px', cursor: canSubmit ? 'pointer' : 'not-allowed' }}
              >
                Propose as Procurement Official
              </button>
            );
          })()}
        </div>
      );
    }

    if (committee.status === 'proposed') {
      const canApprove = actingRole === 'Minister/Director' && !sameWalletConflict && !notAuthorizedDirector;
      return (
        <div style={{ ...cardStyle, marginBottom: 16, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Users style={{ width: 15, height: 15, color: '#92400e' }} />
            <h5 style={{ fontSize: '13.5px', fontWeight: 700, color: '#92400e', margin: 0 }}>{typeName} Proposed — Pending Approval</h5>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {committee.members.map((m: any) => (
              <span key={m.name} style={{ fontSize: '12.5px', color: '#78350f' }}>
                <strong>{m.name}</strong> — {m.department}
              </span>
            ))}
          </div>
          {renderRoleSelector('Minister/Director')}
          {sameWalletConflict && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11.5px', color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
              <AlertCircle style={{ width: 13, height: 13 }} />
              Connect a Minister/Director wallet to approve the proposed committee members.
            </div>
          )}
          {notAuthorizedDirector && !sameWalletConflict && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11.5px', color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
              <AlertCircle style={{ width: 13, height: 13 }} />
              Connected wallet is not an authorized Minister/Director address — approval is refused.
            </div>
          )}
          <button
            onClick={() => approveCommittee(tender.id)}
            disabled={!canApprove}
            title={canApprove ? undefined : sameWalletConflict ? 'Connect a different wallet than the proposer to approve' : notAuthorizedDirector ? 'This wallet is not on the Minister/Director allowlist' : 'Switch "Acting as" to Minister/Director to approve'}
            style={{ ...navyBtnStyle, background: canApprove ? '#065f46' : '#d1d5db', fontSize: '12.5px', cursor: canApprove ? 'pointer' : 'not-allowed' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <UserCheck style={{ width: 13, height: 13 }} /> Approve as Minister/Director
            </span>
          </button>
          <p style={{ fontSize: '10.5px', color: '#9ca3af', marginTop: 6 }}>
            {walletConnected
              ? 'Wallet-bound: the connected address must be on the Minister/Director allowlist, and must differ from whoever proposed, or approval is refused.'
              : 'No wallet is connected, so approval can\'t be checked against a real authorized identity — connect a wallet above for a verified approval, or proceed and it will be recorded as unverified.'}
          </p>
        </div>
      );
    }

    return (
      <div style={{ ...cardStyle, marginBottom: 16, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <Users style={{ width: 15, height: 15, color: '#065f46' }} />
          <h5 style={{ fontSize: '13.5px', fontWeight: 700, color: '#065f46', margin: 0 }}>{typeName} Approved</h5>
          {committee.walletVerified ? (
            <span style={{ ...badgeStyle, background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', fontSize: '10.5px' }} title="Approved by a wallet on the recognized Minister/Director allowlist, distinct from whoever proposed the committee">
              ✓ Authorized Minister/Director approval
            </span>
          ) : (
            <span style={{ ...badgeStyle, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontSize: '10.5px' }} title={'No wallet was connected, or it wasn\'t on the Minister/Director allowlist — this approval relies on the "Acting as" selector only, not a verified authorization'}>
              ⚠ Not wallet-verified
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
          {committee.members.map((m: any) => (
            <span key={m.name} style={{ fontSize: '12px', color: '#065f46' }}>
              <strong>{m.name}</strong> ({m.department})
            </span>
          ))}
        </div>
        {renderRoleSelector()}
        {actingRole === 'Procurement Official' && (
          <>
            <button
              type="button"
              onClick={() => {
                // A seat's bound wallet address is permanent — there's no
                // rebind/edit function anywhere (app-layer or on-chain), so
                // the only way to fix a wrongly-auto-bound seat (e.g. the
                // Procuring Entity's own wallet getting bound to a seat
                // left blank at proposal time) is to discard this
                // committee entirely and propose a fresh one. Needs a new
                // Director approval afterward — that's the real cost of
                // starting over, not anything this button hides.
                setEvaluationCommittees(evaluationCommittees.filter((c) => c.tenderId !== tender.id));
                setCommitteeDraft((prev) => ({ ...prev, [tender.id]: { procurementMember: '', requestingDeptMember: '', otherDeptMember: '', procurementAddr: '', requestingAddr: '', otherAddr: '' } }));
              }}
              style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c', background: 'none', border: '1px solid #fca5a5', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}
            >
              Propose a different committee (discards this one — requires re-approval)
            </button>
            <p style={{ fontSize: '10.5px', color: '#9ca3af', marginTop: 4 }}>
              Use this only to fix a wrongly-bound seat address — there's no way to edit a single seat in place.
            </p>
          </>
        )}
      </div>
    );
  };

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
    const committee = getCommittee(tender.id);
    const currentActor = actingAs[tender.id] || committee?.members[0]?.name || '';
    const seatBlockReason = getSeatBlockReason(tender.id, currentActor);
    const procType = tender.procurementType || 'Goods';
    const isServices = procType === 'Services';
    // Qualification criteria per NPA's Head of Procurement's own answer —
    // license, financial capacity (bank statement), and similar experience
    // apply to every procurement; implementation plan/demo and staff CVs
    // apply to Services specifically. License used to sit in a separate
    // "automated checks" panel as if it weren't part of scoring, but his
    // answer names it as one of the three Goods criteria outright, so it's
    // listed here as a qualification item (still auto-verified, just no
    // longer visually segregated from the rest of his checklist). Each
    // checkbox now does double duty — "I've reviewed the evidence AND
    // judge this criterion met" — collapsing what used to be two separate
    // checkboxes (a document-read attestation, then a judgment call) into
    // one, since asking both never changed the outcome, just the clicking.
    // (An equipment/machinery check for Works was considered but dropped —
    // the official was never asked about it, so it's left out rather than
    // invented.)
    const qualificationItems: { key: keyof MemberEvalInput; label: string }[] = [
      { key: 'similarExperience', label: 'Similar/relevant experience confirmed' },
      { key: 'financialCapacity', label: 'Bank statement reviewed — cash or equivalent financial capacity ≥ project value' },
      ...(isServices ? [
        { key: 'implementationPlan' as const, label: 'Implementation plan / demo reviewed' },
        { key: 'staffCVs' as const, label: 'Staff CVs reviewed and qualified' },
      ] : []),
    ];

    return (
      <div>
        <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2942', marginBottom: 4 }}>
          Preliminary Check &amp; Qualification
        </h5>
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: 12 }}>
          Preliminary checks are pass/fail eligibility gates (Art. 17/20/28). Qualification assesses bidder capacity (also pass/fail) — separate from technical scoring. Each committee member records their own assessment; the result shown is a 2-of-3 majority, not any one member's say-so.
        </p>
        {committee && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#374151' }}>Acting as:</span>
              <select
                value={currentActor}
                onChange={(e) => setActingAs((prev) => ({ ...prev, [tender.id]: e.target.value }))}
                style={{ fontSize: '12px', padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
              >
                {committee.members.map((m: any) => (
                  <option key={m.name} value={m.name}>{m.name} ({m.department})</option>
                ))}
              </select>
              {isSeatWallet(tender.id, currentActor) && (
                <span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: '#065f46', background: '#d1fae5', padding: '2px 8px', borderRadius: 999 }}>
                  Wallet: {walletAccount?.slice(0, 6)}…{walletAccount?.slice(-4)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
              {renderMemberProgress(tender.id, currentActor, tenderBids.map((b: any) => b.id), 'checked')}
              {renderSaveIndicator()}
            </div>
            {seatBlockReason && (
              <div style={{ fontSize: '11px', color: '#b45309', marginTop: 6, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 9px' }}>
                ⚠ {seatBlockReason}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tenderBids.map((bid) => {
            const datum = getEvalDatum(bid.id);
            const mine = getMemberEvalDatum(bid.id, currentActor);
            // Whether THIS member has recorded anything at all for this bid
            // yet — distinguishes "hasn't voted" from "voted Fail" so an
            // untouched checkbox doesn't read as an active rejection.
            const touched = !!memberEvalData[bid.id]?.[currentActor];
            const voteColor = (value: boolean) => (!touched ? '#9ca3af' : value ? '#065f46' : '#dc2626');
            const resultLine = (pass: boolean, scored: number) =>
              scored === 0
                ? { color: '#9ca3af', text: 'Not yet assessed — no votes recorded' }
                : { color: pass ? '#065f46' : '#991b1b', text: `Committee result: ${pass ? 'Pass' : 'Fail'} (majority of ${scored} recorded vote${scored === 1 ? '' : 's'})` };
            const prelimResult = resultLine(datum.preliminaryPass, datum.membersScored);
            const qualResult = resultLine(datum.qualificationPass, datum.membersScored);
            // License is one of the NPA Head's own scoring criteria (Goods),
            // so it's shown inside Qualification below rather than off in a
            // separate "automated checks" panel.
            const license = verifyBusinessLicense(bid.vendorName, registeredSuppliers);
            return (
              <div key={bid.id} style={{ ...cardStyle, opacity: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: '#0f2942', fontSize: '14px' }}>{bid.vendorName}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>{datum.membersScored}/{datum.totalMembers} members evaluated</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {Number(bid.amount).toLocaleString()} AFN
                    </span>
                  </div>
                </div>

                {/* Eligibility Gate — Art. 17/20(1)(d)/28 legal requirements.
                    Bid security is commonly submitted as a bank guarantee
                    (RegisterKYC's own e-KYC form already treats "Bid
                    Security / Guarantee" as one combined item, and this
                    system tracks no other instrument type) — a committee
                    member confirms it directly rather than checking it
                    against a registry no real bank guarantee would ever be
                    found in. */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Eligibility Checks (Art. 17/20/28)</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                      <input
                        type="checkbox"
                        checked={mine.bidSecurity}
                        disabled={!!seatBlockReason}
                        onChange={(e) => updateMemberEvalDatum(tender.id, bid.id, currentActor, { bidSecurity: e.target.checked })}
                        style={{ accentColor: '#0f2942', cursor: seatBlockReason ? 'not-allowed' : 'pointer' }}
                        title={seatBlockReason || undefined}
                      />
                      Bid Security / Guarantee attached
                    </label>
                  </div>
                  {/* Auto-derived from Bid Security above — not a separate
                      manual vote. Ticking every box here IS the Pass vote;
                      there's no second click to remember. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: voteColor(mine.preliminaryPass) }}>
                      {!touched ? 'Preliminary: not yet voted' : mine.preliminaryPass ? '✓ Preliminary: Pass (your vote — auto)' : 'Preliminary: Fail (your vote — auto, check Bid Security above to pass)'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: prelimResult.color, marginTop: 4, fontWeight: 600 }}>
                    {prelimResult.text}
                  </div>
                </div>

                {/* Qualification Criteria — the NPA Head of Procurement's own
                    scoring basis (license, financial capacity, experience,
                    plus Services-only implementation plan/staff CVs). One
                    checkbox per criterion covers both "I reviewed the
                    evidence" and "I judge it met" — there's no longer a
                    separate document-attestation layer asking the same
                    question twice. Shown regardless of the preliminary
                    vote — License is a registry fact a member may well
                    want to see BEFORE deciding preliminary eligibility,
                    not something that should stay hidden until after. */}
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Qualification Criteria — your assessment</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '11.5px', color: license.verified ? '#065f46' : '#991b1b', marginBottom: 6 }} title={license.reason}>
                      {license.verified ? <CheckCircle style={{ width: 13, height: 13 }} /> : <AlertCircle style={{ width: 13, height: 13 }} />}
                      License {license.verified ? `Verified (${license.registrationNumber})` : 'Not Verified'} — auto
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
                      {qualificationItems.map((item) => (
                        <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                          <input
                            type="checkbox"
                            checked={!!mine[item.key]}
                            disabled={!!seatBlockReason}
                            onChange={(e) => updateMemberEvalDatum(tender.id, bid.id, currentActor, { [item.key]: e.target.checked })}
                            style={{ accentColor: '#0f2942', cursor: seatBlockReason ? 'not-allowed' : 'pointer' }}
                            title={seatBlockReason || undefined}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                    {/* Auto-derived from the criteria boxes above (plus
                        the auto-verified license) — not a separate manual
                        vote. Checking every item here IS the Pass vote. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: voteColor(mine.qualificationPass) }}>
                        {!touched ? 'Qualification: not yet voted' : mine.qualificationPass ? '✓ Qualification: Pass (your vote — auto)' : 'Qualification: Fail (your vote — auto, check every item above, including a verified license, to pass)'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: qualResult.color, marginTop: 4, fontWeight: 600 }}>
                      {qualResult.text}
                    </div>
                    {(() => {
                      // Excluding the Director here too — otherwise a seat
                      // wrongly bound to the Director's address before this
                      // fix existed would still let that wallet cast an
                      // on-chain evaluator vote, even though it can no
                      // longer touch the checklist itself.
                      const seatMatch = committee?.members.some((m: any) => m.name === currentActor && m.address?.toLowerCase() === walletAccount?.toLowerCase()) && !isAuthorizedDirector(walletAccount);
                      const seat = committee?.members.find((m: any) => m.name === currentActor);
                      const status = voteStatus[`${bid.id}:${currentActor}`];
                      // alreadyVoted is the durable, shared fact (reads
                      // blockchainRecords); status is this device's own
                      // just-now transaction feedback and takes priority
                      // while it's fresh — once the tab closes, alreadyVoted
                      // is the only thing left to show it ever happened.
                      const alreadyVoted = hasVotedOnChain(bid.id, currentActor);
                      if (walletConnected && seatMatch) {
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => submitVoteOnChain(tender.id, bid.id, currentActor)}
                              disabled={status?.state === 'pending'}
                              style={{ marginTop: 6, fontSize: '11px', fontWeight: 700, color: '#1c5cab', background: 'none', border: '1px solid #bcd6f5', borderRadius: 999, padding: '3px 10px', cursor: status?.state === 'pending' ? 'not-allowed' : 'pointer', opacity: status?.state === 'pending' ? 0.6 : 1 }}
                              title={alreadyVoted ? 'Already voted on-chain — click to re-submit your current checklist judgment' : 'Records your current preliminary + qualification judgment on-chain via voteOnBid'}
                            >
                              {status?.state === 'pending' ? 'Submitting…' : alreadyVoted ? 'Re-submit vote on-chain' : 'Submit vote on-chain'}
                            </button>
                            {status?.state === 'error' ? (
                              <div style={{ fontSize: '11px', color: '#991b1b', marginTop: 4, fontWeight: 600 }}>⚠ {status.message}</div>
                            ) : (status?.state === 'success' || alreadyVoted) && (
                              <div style={{ fontSize: '11px', color: '#065f46', marginTop: 4, fontWeight: 600 }}>✓ Voted on-chain</div>
                            )}
                          </>
                        );
                      }
                      // Connected, but to the wrong wallet for whoever is
                      // currently selected in "Acting as" — this used to
                      // just silently hide the button with no explanation,
                      // which looked identical to "nothing happened" when
                      // clicking checkboxes for a different member.
                      if (walletConnected && seat?.address) {
                        return (
                          <div style={{ fontSize: '10.5px', color: '#9ca3af', marginTop: 4 }}>
                            Connect wallet {seat.address.slice(0, 6)}…{seat.address.slice(-4)} to vote on-chain as {currentActor}.
                          </div>
                        );
                      }
                      return null;
                    })()}
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

  const getTechnicalCriteria = (procurementType: string) => {
    switch (procurementType) {
      case 'Services':
        return [
          { label: 'Relevant Experience (25%)', weight: 25 },
          { label: 'Methodology & Approach (40%)', weight: 40 },
          { label: 'Key Personnel Qualifications (35%)', weight: 35 },
        ];
      case 'Works':
        return [
          { label: 'Construction Methodology', weight: 30 },
          { label: 'Equipment & Machinery', weight: 25 },
          { label: 'Key Personnel & Staffing', weight: 25 },
          { label: 'Work Schedule & Timeline', weight: 20 },
        ];
      default: // Goods
        return [
          { label: 'Specification Compliance', weight: 40 },
          { label: 'Delivery Schedule', weight: 30 },
          { label: 'Warranty & After-Sales Support', weight: 30 },
        ];
    }
  };

  const renderStage2 = (tender: any) => {
    const tenderBids = getTenderBids(tender.id);
    const qualifiedBids = tenderBids.filter((bid) => {
      const d = getEvalDatum(bid.id);
      return d.preliminaryPass && d.qualificationPass;
    });
    const failedBids = tenderBids.filter((bid) => {
      const d = getEvalDatum(bid.id);
      return !d.preliminaryPass || !d.qualificationPass;
    });
    const procType = tender.procurementType || 'Goods';
    const criteria = getTechnicalCriteria(procType);
    const committee = getCommittee(tender.id);
    const currentActor = actingAs[tender.id] || committee?.members[0]?.name || '';
    // Stage 2's technical score input never got this check when it was
    // first built, unlike Stage 1 and RFQ — meaning any connected wallet,
    // matching or not, could type and submit a score for whoever the
    // dropdown happened to be on. Closing that gap here.
    const seatBlockReason = getSeatBlockReason(tender.id, currentActor);

    return (
      <div>
        <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2942', marginBottom: 4 }}>
          Stage 2: Technical Evaluation
        </h5>
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: 12 }}>
          Criteria for <strong>{procType}</strong> procurement
          {procType === 'Services' ? ' (QCBS, per Procurement Procedures — Art. 22(6))' : ' (Lowest Evaluated Bid — Art. 22(5))'}
          {' — each member scores independently; the committee score shown is the average.'}
        </p>

        {/* Criteria breakdown info */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {criteria.map((c) => (
            <span key={c.label} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: 999, background: '#ede9fe', color: '#5b21b6', fontWeight: 600 }}>
              {c.label}
            </span>
          ))}
        </div>

        {committee && (
          // Stage 1 and Stage 2 are never visible at the same time (the
          // stepper shows one stage at a time), so each gets its own
          // interactive selector rather than sharing one — there's no
          // simultaneous duplication to dedupe here.
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#374151' }}>Acting as:</span>
              <select
                value={currentActor}
                onChange={(e) => setActingAs((prev) => ({ ...prev, [tender.id]: e.target.value }))}
                style={{ fontSize: '12px', padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
              >
                {committee.members.map((m: any) => (
                  <option key={m.name} value={m.name}>{m.name} ({m.department})</option>
                ))}
              </select>
              {isSeatWallet(tender.id, currentActor) && (
                <span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: '#065f46', background: '#d1fae5', padding: '2px 8px', borderRadius: 999 }}>
                  Wallet: {walletAccount?.slice(0, 6)}…{walletAccount?.slice(-4)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
              {renderMemberProgress(tender.id, currentActor, qualifiedBids.map((b: any) => b.id), 'scored')}
              {renderSaveIndicator()}
            </div>
            {seatBlockReason && (
              <div style={{ fontSize: '11px', color: '#b45309', marginTop: 6, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 9px' }}>
                ⚠ {seatBlockReason}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {qualifiedBids.map((bid) => {
            const datum = getEvalDatum(bid.id);
            const mine = getMemberEvalDatum(bid.id, currentActor);
            return (
              <div key={bid.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: '#0f2942', fontSize: '14px' }}>{bid.vendorName}</span>
                  <span style={{ ...badgeStyle, background: '#d1fae5', color: '#065f46' }}>Qualified</span>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: 2 }}>Technical Proposal: {bid.technicalProposal}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>Experience: {bid.experience}</p>
                </div>
                {(() => {
                  const draftKey = `${bid.id}:${currentActor}`;
                  const draft = technicalScoreDrafts[draftKey];
                  // Falls back to the already-submitted score whenever
                  // there's no in-progress edit — switching to a bid you
                  // already scored shows what you submitted, not blank.
                  const displayValue = draft !== undefined ? draft : (mine.technicalScore || '');
                  const parsed = Number(draft);
                  const canSubmit = !seatBlockReason && draft !== undefined && draft !== '' && !Number.isNaN(parsed) && parsed >= 0 && parsed <= 100;
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Your Technical Score (0-100):</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          disabled={!!seatBlockReason}
                          value={displayValue}
                          onChange={(e) => setTechnicalScoreDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))}
                          style={{
                            width: 80,
                            padding: '6px 10px',
                            border: '1px solid rgba(11,11,11,0.15)',
                            borderRadius: 6,
                            fontSize: '13px',
                            cursor: seatBlockReason ? 'not-allowed' : 'text',
                            background: seatBlockReason ? '#f3f4f6' : '#fff',
                          }}
                          title={seatBlockReason || undefined}
                        />
                        <button
                          type="button"
                          disabled={!canSubmit}
                          title={seatBlockReason || undefined}
                          onClick={() => {
                            updateMemberEvalDatum(tender.id, bid.id, currentActor, { technicalScore: Math.min(100, Math.max(0, parsed)), technicalScored: true });
                            setTechnicalScoreDrafts((prev) => { const next = { ...prev }; delete next[draftKey]; return next; });
                          }}
                          style={{
                            fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: 6, border: 'none',
                            color: '#fff', background: canSubmit ? '#0f2942' : '#d1d5db', cursor: canSubmit ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Submit
                        </button>
                        {draft === undefined && mine.technicalScored && (
                          <span style={{ fontSize: '11px', color: '#065f46', fontWeight: 600 }}>✓ Submitted</span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: datum.technicalScored ? '#065f46' : '#6b7280', fontWeight: datum.technicalScored ? 600 : 400, marginTop: 6 }}>
                        {datum.technicalScored ? 'Final committee score: ' : 'Provisional average so far: '}
                        <strong style={{ color: '#0f2942' }}>{datum.technicalScore}/100</strong> ({datum.technicalMembersScored}/{datum.totalMembers} members scored{!datum.technicalScored ? ' — not final until all 3 score' : ''})
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {failedBids.map((bid) => {
            const d = getEvalDatum(bid.id);
            const reason = !d.preliminaryPass ? 'Failed Preliminary' : 'Failed Qualification';
            return (
              <div key={bid.id} style={{ ...cardStyle, opacity: 0.45 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#6b7280', fontSize: '14px' }}>{bid.vendorName}</span>
                  <span style={{ ...badgeStyle, background: '#fee2e2', color: '#991b1b' }}>{reason}</span>
                </div>
              </div>
            );
          })}
        </div>
        {qualifiedBids.length === 0 ? (
          <div style={{ marginTop: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: '#92400e' }}>
              No bid passed Preliminary &amp; Qualification, so there is nothing to technically evaluate. If this doesn't look right, go back and revise the committee's Stage 1 votes.
            </span>
            <button
              type="button"
              onClick={() => goToStage(tender.id, 1)}
              style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', background: '#fff', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ← Back to Stage 1
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => goToStage(tender.id, 1)}
              style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              ← Back to Stage 1
            </button>
            <button style={navyBtnStyle} onClick={() => advanceStage(tender.id)}>
              Complete Stage 2
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderStage3 = (tender: any) => {
    const tenderBids = getTenderBids(tender.id);
    const qualifiedBids = tenderBids.filter((bid) => {
      const d = getEvalDatum(bid.id);
      return d.preliminaryPass && d.qualificationPass;
    });
    const failedBids = tenderBids.filter((bid) => {
      const d = getEvalDatum(bid.id);
      return !d.preliminaryPass || !d.qualificationPass;
    });
    const procType = tender.procurementType || 'Goods';

    return (
      <div>
        <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2942', marginBottom: 4 }}>
          Stage 3: Financial Evaluation
        </h5>
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: 12 }}>
          {procType === 'Services'
            ? 'Financial weight: 30% (QCBS method, per Procurement Procedures — Art. 22(6))'
            : 'Financial weight: 70% (Lowest Evaluated Bid per Art. 22(5))'}
          {' — Domestic firms may receive a 25% price preference.'}
          {' Financial score is auto-calculated from each bid’s submitted amount (Rule 72(2)) — no evaluator can enter it manually.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {qualifiedBids.map((bid) => {
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
                <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: '13px', flexWrap: 'wrap' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Financial Score:</label>
                    <span
                      title="Auto-calculated from the submitted bid amount (Rule 72(2): lowest qualified bid = 100 points, others scored proportionally). Not editable — cannot be hand-typed by an evaluator."
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        width: 'fit-content',
                        padding: '6px 10px',
                        border: '1px solid rgba(11,11,11,0.15)',
                        borderRadius: 6,
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#0f2942',
                        background: '#f9fafb',
                      }}
                    >
                      {computeAutoFinancialScore(tender.id, bid.id)}/100
                      <Shield style={{ width: 12, height: 12, color: '#065f46' }} />
                    </span>
                  </div>
                  {/* 25% Domestic Preference */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px', color: '#374151', background: datum.isDomestic ? '#fefce8' : 'transparent', padding: '4px 10px', borderRadius: 6, border: datum.isDomestic ? '1px solid #fcd34d' : '1px solid transparent' }}>
                    <input
                      type="checkbox"
                      checked={datum.isDomestic}
                      onChange={(e) => setDomesticFlag(bid.id, e.target.checked)}
                      style={{ accentColor: GOLD }}
                    />
                    <span style={{ fontWeight: 600 }}>Domestic Firm (+25%)</span>
                  </label>
                  {datum.isDomestic && (
                    <span style={{ ...badgeStyle, background: '#fef3c7', color: '#92400e', fontSize: '11px' }}>
                      +25% preference applied
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {failedBids.map((bid) => {
            const d = getEvalDatum(bid.id);
            const reason = !d.preliminaryPass ? 'Failed Preliminary' : 'Failed Qualification';
            return (
              <div key={bid.id} style={{ ...cardStyle, opacity: 0.45 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#6b7280', fontSize: '14px' }}>{bid.vendorName}</span>
                  <span style={{ ...badgeStyle, background: '#fee2e2', color: '#991b1b' }}>{reason}</span>
                </div>
              </div>
            );
          })}
        </div>
        {qualifiedBids.length === 0 ? (
          <div style={{ marginTop: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: '#92400e' }}>
              No bid passed Preliminary &amp; Qualification, so there is nothing to price. If this doesn't look right, go back and revise the committee's Stage 1 votes.
            </span>
            <button
              type="button"
              onClick={() => goToStage(tender.id, 1)}
              style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', background: '#fff', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ← Back to Stage 1
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => goToStage(tender.id, 1)}
              style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              ← Back to Stage 1
            </button>
            <button
              style={navyBtnStyle}
              onClick={() => advanceStage(tender.id)}
            >
              Complete Stage 3
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderStage4 = (tender: any) => {
    const ranked = getRankedBids(tender.id);
    const failedBids = getTenderBids(tender.id).filter((bid) => {
      const d = getEvalDatum(bid.id);
      return !d.preliminaryPass || !d.qualificationPass;
    });
    const reportExists = reports.some((r) => r.tenderId === tender.id && r.type === 'evaluation_report');
    const procType = tender.procurementType || 'Goods';
    const isServices = procType === 'Services';
    const techWeight = isServices ? '70%' : '30%';
    const finWeight = isServices ? '30%' : '70%';

    return (
      <div>
        <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#0f2942', marginBottom: 4 }}>
          Stage 4: Combined Score & Ranking
        </h5>
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: 12 }}>
          {isServices
            ? 'QCBS method: Technical 70% + Financial 30% (per Procurement Procedures — Art. 22(6))'
            : 'Lowest Evaluated Bid: Technical 30% + Financial 70% (Art. 22(5))'}
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Rank</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Vendor</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Technical ({techWeight})</th>
                <th style={{ textAlign: 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 600 }}>Financial ({finWeight})</th>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: '#0f2942' }}>{bid.vendorName}</span>
                        {isWinner && (
                          <span style={{ ...badgeStyle, background: GOLD, color: '#fff' }}>
                            Recommended Winner
                          </span>
                        )}
                        {datum.isDomestic && (
                          <span style={{ ...badgeStyle, background: '#fef3c7', color: '#92400e', fontSize: '10px' }}>
                            Domestic +25%
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>
                      {datum.technicalScore}
                      {!datum.technicalScored && (
                        <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 600, marginLeft: 4 }} title={`Only ${datum.technicalMembersScored}/${datum.totalMembers} members have entered a technical score so far`}>
                          (provisional)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{datum.financialScore}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: isWinner ? GOLD : '#0f2942' }}>
                      {datum.combinedScore.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {isWinner && (
                        datum.technicalScored ? (
                          <button
                            style={{ ...navyBtnStyle, background: '#065f46', fontSize: '12px', padding: '6px 12px' }}
                            onClick={() => awardContract(tender, bid)}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Award style={{ width: 14, height: 14 }} /> Award Contract
                            </span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '10.5px', color: '#b45309' }} title="The ranking above can still change once every member has scored — awarding is disabled until then.">
                            Waiting on {datum.totalMembers - datum.technicalMembersScored} more technical score{datum.totalMembers - datum.technicalMembersScored === 1 ? '' : 's'}
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              {failedBids.map((bid) => {
                const d = getEvalDatum(bid.id);
                const reason = !d.preliminaryPass ? 'Failed Preliminary' : 'Failed Qualification';
                return (
                  <tr key={bid.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: 0.4 }}>
                    <td style={{ padding: '10px', color: '#9ca3af' }}>-</td>
                    <td style={{ padding: '10px', color: '#9ca3af' }}>{bid.vendorName}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#9ca3af' }}>-</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#9ca3af' }}>-</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#9ca3af' }}>-</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <span style={{ ...badgeStyle, background: '#fee2e2', color: '#991b1b' }}>{reason}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {ranked.length === 0 && (
          <div style={{ marginTop: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: '#92400e' }}>
              No bid passed Preliminary &amp; Qualification, so there is no winner to rank or award. If this doesn't look right, go back and revise the committee's Stage 1 votes.
            </span>
            <button
              type="button"
              onClick={() => goToStage(tender.id, 1)}
              style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', background: '#fff', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ← Back to Stage 1
            </button>
          </div>
        )}

        {/* Generate Evaluation Report */}
        <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => goToStage(tender.id, 1)}
            style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← Back to Stage 1
          </button>
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

      {/* Flagged for Re-Review Section */}
      {flaggedForReReview.length > 0 && (
        <div style={{ ...cardStyle, borderColor: '#f59e0b', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Flag style={{ width: 18, height: 18, color: '#d97706' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#92400e', margin: 0 }}>Flagged for Evaluation Committee Re-Review</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {flaggedForReReview.map((flagged) => {
              const tender = tenders.find((td) => td.id === flagged.tenderId);
              const complaint = disputes.find((d) => d.id === flagged.complaintId);
              if (!tender) return null;
              const isReReviewing = complaint?.status === 'rereview_in_progress';
              return (
                <div key={flagged.complaintId} style={{ background: '#fff', border: '1px solid #fcd34d', borderRadius: 8, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f2942' }}>{tender.title}</span>
                        <span style={{ ...badgeStyle, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>Re-Review Required</span>
                        {isReReviewing && (
                          <span style={{ ...badgeStyle, background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' }}>Re-Review in Progress</span>
                        )}
                      </div>
                      <p style={{ color: '#6b7280', fontSize: '12.5px', margin: '2px 0' }}>Triggered by: {flagged.complaintTitle}</p>
                      {complaint?.evidence && (
                        <p style={{ color: '#9ca3af', fontSize: '11.5px', margin: '2px 0' }}>Evidence: {complaint.evidence}</p>
                      )}
                    </div>
                    {!isReReviewing && (
                      <button
                        onClick={() => handleBeginReReview(flagged.tenderId, flagged.complaintId)}
                        style={{ ...navyBtnStyle, fontSize: '12px', padding: '7px 12px' }}
                      >
                        Begin Re-Review
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              const allBids = getAllTenderBids(tender.id);
              const tenderBids = getTenderBids(tender.id);
              const isAwarded = tender.status === 'awarded' || tender.status === 'standstill';
              const currentStage = getCurrentStage(tender.id);
              const isSelected = selectedTender?.id === tender.id;
              // Art. 3(10): Single-source is "concluded directly without tendering" —
              // no competitive multi-stage evaluation applies.
              const isSingleSource = tender.method === 'Single-Source';
              // Procurement Procedures Rule 19: RFQ requires quotations from at least
              // 3 sources (19(4)) and awards to the lowest price only (19(7)) — no
              // multi-stage technical/financial evaluation.
              const isRFQ = tender.method === 'Request for Quotations';
              const RFQ_MIN_QUOTATIONS = 3;
              const rfqReady = !isRFQ || tenderBids.length >= RFQ_MIN_QUOTATIONS;
              // Bids are sealed (commit-reveal) until the deadline passes — evaluating
              // or awarding earlier would mean reading amounts before every bidder has
              // had the chance to reveal, defeating the point of sealing them at all.
              const deadlinePassed = new Date(tender.deadline).getTime() <= Date.now();
              const pendingReveal = allBids.length - tenderBids.length;
              // Art. 3(18)/3(19)/23(1)-(2): competitive methods need a
              // proposed-and-approved Evaluation Committee before evaluation
              // starts. Single-Source has no evaluation to gate (Art. 3(10)).
              const committee = getCommittee(tender.id);
              const committeeApproved = isSingleSource || committee?.status === 'approved';

              return (
                <div key={tender.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isSelected && !isAwarded ? 16 : 0 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h4 style={{ fontWeight: 700, color: '#0f2942', fontSize: '15px', margin: 0 }}>{tender.title}</h4>
                        {flaggedTenderIds.includes(tender.id) && (
                          <span style={{ ...badgeStyle, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', fontSize: '10px' }}>
                            <Flag style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                            Re-Review
                          </span>
                        )}
                      </div>
                      <p style={{ color: '#6b7280', fontSize: '13px', marginTop: 2 }}>
                        {allBids.length} bids received
                        {!isSingleSource && pendingReveal > 0 && ` · ${pendingReveal} sealed, awaiting reveal`}
                      </p>
                    </div>
                    {isAwarded ? (
                      <span style={{ ...badgeStyle, background: tender.status === 'standstill' ? '#fef3c7' : '#d1fae5', color: tender.status === 'standstill' ? '#92400e' : '#065f46' }}>
                        {tender.status === 'standstill' ? 'Standstill Period' : 'Contract Awarded'}
                      </span>
                    ) : !deadlinePassed ? (
                      <span style={{ ...badgeStyle, background: '#fef3c7', color: '#92400e' }} title="Bids stay sealed until the submission deadline passes">
                        <Lock style={{ width: 10, height: 10, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                        Sealed until deadline
                      </span>
                    ) : !rfqReady ? (
                      <span style={{ ...badgeStyle, background: '#f3f4f6', color: '#6b7280' }} title="Rule 19(4): RFQ requires quotations from at least 3 sources">
                        Awaiting quotations ({tenderBids.length}/{RFQ_MIN_QUOTATIONS})
                      </span>
                    ) : (
                      <button
                        onClick={() => setSelectedTender(isSelected ? null : tender)}
                        style={navyBtnStyle}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Award style={{ width: 14, height: 14 }} />
                          {isSelected ? 'Close Evaluation' : committeeApproved ? 'Evaluate & Award' : 'Form Committee'}
                        </span>
                      </button>
                    )}
                  </div>

                  {isSelected && !isAwarded && !isSingleSource && renderCommitteeSection(tender)}

                  {isSelected && !isAwarded && isSingleSource && (
                    <div style={{ borderTop: '1px solid rgba(11,11,11,0.08)', paddingTop: 16 }}>
                      <div style={{ background: '#f3eefe', border: '1px solid #ddd6fe', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: '12.5px', color: '#5b21b6' }}>
                        Single-source procurement (Art. 3(10)): concluded directly, without competitive tendering or multi-stage evaluation.
                        {tender.singleSourceJustification && (
                          <div style={{ marginTop: 4 }}><strong>Justification:</strong> {tender.singleSourceJustification}</div>
                        )}
                      </div>
                      {tenderBids.slice(0, 1).map((bid) => (
                        <div key={bid.id} style={cardStyle}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, color: '#0f2942', fontSize: '14px' }}>{bid.vendorName}</span>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>{Number(bid.amount).toLocaleString()} AFN</span>
                          </div>
                          <button
                            style={{ ...navyBtnStyle, background: '#065f46' }}
                            onClick={() => awardContract(tender, bid)}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Award style={{ width: 14, height: 14 }} /> Award Contract (Direct)
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {isSelected && !isAwarded && isRFQ && committeeApproved && (() => {
                    // Rule 19(7): "the lowest-priced quotation meeting requirements" —
                    // not just the lowest number outright. A bid that doesn't meet the
                    // specification can't win just because it's cheapest, so compliance
                    // must be checked per bid before price ranking decides the winner.
                    // Reuses the same preliminaryPass field the multi-stage methods use
                    // for their own pass/fail screening, rather than a new flag.
                    //
                    // Unlike Open/Restricted Bidding, RFQ does not additionally require
                    // a verified bank guarantee or bank statement — RFQ collection in
                    // practice only asks for the quotation itself, and that full
                    // document-verification step is heavier than this lightweight,
                    // below-threshold method is meant to carry. Business license is kept
                    // as a gate though: it's a free, automatic registry lookup (no extra
                    // burden on the committee), not a document someone has to produce.
                    const isFullyCleared = (bid: any) => {
                      const datum = getEvalDatum(bid.id);
                      const license = verifyBusinessLicense(bid.vendorName, registeredSuppliers);
                      return datum.preliminaryPass && license.verified;
                    };
                    const sorted = [...tenderBids].sort((a, b) => Number(a.amount) - Number(b.amount));
                    const lowestCompliantId = sorted.find((bid) => isFullyCleared(bid))?.id;
                    const currentActor = actingAs[tender.id] || committee?.members[0]?.name || '';
                    const seatBlockReason = getSeatBlockReason(tender.id, currentActor);
                    return (
                    <div style={{ borderTop: '1px solid rgba(11,11,11,0.08)', paddingTop: 16 }}>
                      <div style={{ background: '#eef5fd', border: '1px solid #bcd6f5', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: '12.5px', color: '#1c5cab' }}>
                        Request for Quotations (Rule 19(7)): each Procurement Inspection Committee member independently verifies the quotation against specification and price; a 2-of-3 majority decides, then the lowest price among compliant quotations is selected — no multi-stage technical/financial evaluation applies.
                      </div>
                      {committee && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#374151' }}>Acting as:</span>
                            <select
                              value={currentActor}
                              onChange={(e) => setActingAs((prev) => ({ ...prev, [tender.id]: e.target.value }))}
                              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
                            >
                              {committee.members.map((m: any) => (
                                <option key={m.name} value={m.name}>{m.name} ({m.department})</option>
                              ))}
                            </select>
                            {isSeatWallet(tender.id, currentActor) && (
                              <span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', color: '#065f46', background: '#d1fae5', padding: '2px 8px', borderRadius: 999 }}>
                                Wallet: {walletAccount?.slice(0, 6)}…{walletAccount?.slice(-4)}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                            {renderMemberProgress(tender.id, currentActor, tenderBids.map((b: any) => b.id), 'checked')}
                            {renderSaveIndicator()}
                          </div>
                          {seatBlockReason && (
                            <div style={{ fontSize: '11px', color: '#b45309', marginTop: 6, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 9px' }}>
                              ⚠ {seatBlockReason}
                            </div>
                          )}
                        </div>
                      )}
                      {sorted.map((bid) => {
                        const datum = getEvalDatum(bid.id);
                        const mine = getMemberEvalDatum(bid.id, currentActor);
                        const isLowestCompliant = bid.id === lowestCompliantId;
                        const license = verifyBusinessLicense(bid.vendorName, registeredSuppliers);
                        return (
                        <div key={bid.id} style={{ ...cardStyle, marginBottom: 8, background: isLowestCompliant ? '#fefce8' : cardStyle.background, opacity: datum.preliminaryPass ? 1 : 0.6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, color: '#0f2942', fontSize: '14px' }}>{bid.vendorName}</span>
                              {isLowestCompliant && (
                                <span style={{ ...badgeStyle, background: GOLD, color: '#fff' }}>Lowest Compliant Price</span>
                              )}
                              <span
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 700, color: license.verified ? '#065f46' : '#991b1b' }}
                                title={license.reason}
                              >
                                {license.verified ? <CheckCircle style={{ width: 12, height: 12 }} /> : <AlertCircle style={{ width: 12, height: 12 }} />}
                                License {license.verified ? `Verified (${license.registrationNumber})` : 'Not Verified'} — auto
                              </span>
                              {(() => {
                                const revealVerified = verifyRevealedBid(bid);
                                if (revealVerified === null) return null;
                                return (
                                  <span
                                    style={{ fontSize: 10.5, fontWeight: 700, color: revealVerified ? '#065f46' : '#991b1b' }}
                                    title={revealVerified ? 'The revealed (amount, salt) independently recomputes to the committed hash' : 'Revealed value does not match the original commitment'}
                                  >
                                    {revealVerified ? '✓ Verified reveal' : '✗ Integrity check failed'}
                                  </span>
                                );
                              })()}
                            </div>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>{Number(bid.amount).toLocaleString()} AFN</span>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer', marginBottom: 4 }}>
                            <input
                              type="checkbox"
                              checked={mine.preliminaryPass}
                              disabled={!!seatBlockReason}
                              onChange={(e) => updateMemberEvalDatum(tender.id, bid.id, currentActor, { preliminaryPass: e.target.checked })}
                              style={{ cursor: seatBlockReason ? 'not-allowed' : 'pointer' }}
                              title={seatBlockReason || undefined}
                            />
                            <span style={{ fontWeight: 600, color: mine.preliminaryPass ? '#065f46' : '#6b7280' }}>Meets specification (your vote)</span>
                          </label>
                          {(() => {
                            // Same Director exclusion as the multi-stage
                            // flow's vote button — see the comment there.
                            const seatMatch = committee?.members.some((m: any) => m.name === currentActor && m.address?.toLowerCase() === walletAccount?.toLowerCase()) && !isAuthorizedDirector(walletAccount);
                            const seat = committee?.members.find((m: any) => m.name === currentActor);
                            const status = voteStatus[`${bid.id}:${currentActor}`];
                            const alreadyVoted = hasVotedOnChain(bid.id, currentActor);
                            if (walletConnected && seatMatch) {
                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => submitVoteOnChain(tender.id, bid.id, currentActor)}
                                    disabled={status?.state === 'pending'}
                                    style={{ marginBottom: 6, fontSize: '11px', fontWeight: 700, color: '#1c5cab', background: 'none', border: '1px solid #bcd6f5', borderRadius: 999, padding: '3px 10px', cursor: status?.state === 'pending' ? 'not-allowed' : 'pointer', opacity: status?.state === 'pending' ? 0.6 : 1 }}
                                    title={alreadyVoted ? 'Already voted on-chain — click to re-submit your current checklist judgment' : 'Records your current spec-compliance judgment on-chain via voteOnBid'}
                                  >
                                    {status?.state === 'pending' ? 'Submitting…' : alreadyVoted ? 'Re-submit vote on-chain' : 'Submit vote on-chain'}
                                  </button>
                                  {status?.state === 'error' ? (
                                    <div style={{ fontSize: '11px', color: '#991b1b', marginBottom: 6, fontWeight: 600 }}>⚠ {status.message}</div>
                                  ) : (status?.state === 'success' || alreadyVoted) && (
                                    <div style={{ fontSize: '11px', color: '#065f46', marginBottom: 6, fontWeight: 600 }}>✓ Voted on-chain</div>
                                  )}
                                </>
                              );
                            }
                            if (walletConnected && seat?.address) {
                              return (
                                <div style={{ fontSize: '10.5px', color: '#9ca3af', marginBottom: 6 }}>
                                  Connect wallet {seat.address.slice(0, 6)}…{seat.address.slice(-4)} to vote on-chain as {currentActor}.
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div style={{ fontSize: '11px', color: datum.preliminaryPass ? '#065f46' : '#991b1b', fontWeight: 600, marginBottom: isLowestCompliant ? 8 : 0 }}>
                            Inspection Committee result: {datum.preliminaryPass ? 'Meets specification' : 'Does not meet specification'} ({datum.membersScored}/{datum.totalMembers} voted)
                          </div>
                          {isLowestCompliant && (
                            <button
                              style={{ ...navyBtnStyle, background: '#065f46' }}
                              onClick={() => awardContract(tender, bid)}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Award style={{ width: 14, height: 14 }} /> Award to Lowest Compliant Price
                              </span>
                            </button>
                          )}
                        </div>
                        );
                      })}
                    </div>
                    );
                  })()}

                  {isSelected && !isAwarded && !isSingleSource && !isRFQ && committeeApproved && (
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
                        {contractObj.standstillExempt && (
                          <span style={{ ...badgeStyle, color: '#5b21b6', background: '#ede9fe' }} title="Art. 43(4): Single-source contracts are not subjected to this article">
                            Single-source — standstill exempt
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

                      {/* Winner Email Notification Status */}
                      {contractObj.emailNotification && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                          <Mail style={{ width: 13, height: 13, color: '#6b7280' }} />
                          {contractObj.emailNotification === 'sent' && (
                            <span style={{ ...badgeStyle, background: '#d1fae5', color: '#065f46' }}>
                              Winner notified by email
                            </span>
                          )}
                          {contractObj.emailNotification === 'failed' && (
                            <span style={{ ...badgeStyle, background: '#fee2e2', color: '#991b1b' }}>
                              Email notification failed
                            </span>
                          )}
                          {contractObj.emailNotification === 'not_configured' && (
                            <span style={{ ...badgeStyle, background: '#f3f4f6', color: '#6b7280' }} title="Set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY to enable">
                              Email notifications not configured
                            </span>
                          )}
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
