// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProcurementSystem — On-chain procurement registry with DAO voting
/// @notice Stores tenders, bids, awards, payments, disputes, and whistleblower reports on-chain
contract ProcurementSystem {

    // ── Role Management ────────────────────────────────────────────────
    enum Role { None, Citizen, Supplier, Government, Auditor, Oversight }

    address public owner;
    mapping(address => Role) public walletRoles;

    event RoleAssigned(address indexed account, Role role);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        walletRoles[msg.sender] = Role.Government;
        // Bootstrap seed matching the app-layer Minister/Director allowlist
        // already used in this prototype (src/utils/committeeVerification.ts)
        // — a public address, not a secret. Owner can add/remove further
        // Directors post-deployment via setAuthorizedDirector.
        authorizedDirectors[0x15bFf92fe34e25633dc2F91834EE6d921002f55F] = true;
        emit DirectorAuthorized(0x15bFf92fe34e25633dc2F91834EE6d921002f55F, true);
    }

    /// @notice Owner grants/revokes Minister/Director committee-approval authority
    function setAuthorizedDirector(address account, bool authorized) external onlyOwner {
        authorizedDirectors[account] = authorized;
        emit DirectorAuthorized(account, authorized);
    }

    /// @notice Self-register as Citizen or Supplier
    function registerRole(uint8 role) external {
        require(walletRoles[msg.sender] == Role.None, "Already registered");
        require(role == uint8(Role.Citizen) || role == uint8(Role.Supplier), "Can only self-register as Citizen or Supplier");
        walletRoles[msg.sender] = Role(role);
        emit RoleAssigned(msg.sender, Role(role));
    }

    /// @notice Owner assigns privileged roles (Government, Auditor, Oversight)
    function assignRole(address account, uint8 role) external onlyOwner {
        require(role >= uint8(Role.Citizen) && role <= uint8(Role.Oversight), "Invalid role");
        walletRoles[account] = Role(role);
        emit RoleAssigned(account, Role(role));
    }

    /// @notice Get role for an address
    function getRole(address account) external view returns (uint8) {
        return uint8(walletRoles[account]);
    }

    // ── Events ──────────────────────────────────────────────────────────
    event TenderCreated(bytes32 indexed tenderId, address indexed creator, string title, uint256 budget, uint256 deadline);
    event TenderPublished(bytes32 indexed tenderId, address indexed publisher);
    event BidCommitted(bytes32 indexed tenderId, bytes32 indexed bidId, address indexed bidder, bytes32 commitment);
    event BidRevealed(bytes32 indexed tenderId, bytes32 indexed bidId, address indexed bidder, uint256 amount);
    event CommitteeProposed(bytes32 indexed tenderId, address indexed proposer, address member0, address member1, address member2);
    event CommitteeApproved(bytes32 indexed tenderId, address indexed approver);
    event BidVoted(bytes32 indexed tenderId, bytes32 indexed bidId, address indexed voter, bool preliminaryPass, bool qualificationPass);
    event ContractAwarded(bytes32 indexed tenderId, bytes32 indexed bidId, address indexed vendor, uint256 amount);
    event PaymentProcessed(bytes32 indexed contractId, uint256 milestoneId, uint256 amount);
    event DisputeCreated(bytes32 indexed disputeId, address indexed creator, string title);
    event VoteCast(bytes32 indexed disputeId, address indexed voter, bool approve);
    event DisputeResolved(bytes32 indexed disputeId, bool approved, uint256 approvalRate);
    event WhistleblowerReport(bytes32 indexed reportId, bytes32 zkProofHash, string category, string severity);
    event SupplierRegistered(address indexed supplier, string companyName);
    event DirectorAuthorized(address indexed account, bool authorized);

    // ── Structs ─────────────────────────────────────────────────────────
    struct Tender {
        bytes32 id;
        address creator;
        string title;
        uint256 budget;
        uint256 deadline;
        bool published;
        bool awarded;
        uint256 createdAt;
    }

    // Commit-reveal sealed bid. `commitment` is keccak256(abi.encode(amount,
    // salt)) at submission time; `amount` stays 0 and `revealed` false until
    // the bidder proves they know the (amount, salt) behind it — the chain
    // itself refuses a reveal that doesn't recompute to the stored
    // commitment, so integrity no longer depends on the app checking
    // honestly. Single-Source bids (nothing to seal against — Art. 3(10))
    // skip commit-reveal entirely via submitBidDirect, which sets
    // `revealed = true` immediately with `commitment = 0`.
    struct Bid {
        bytes32 id;
        bytes32 tenderId;
        address bidder;
        bytes32 commitment;
        uint256 amount;
        bool revealed;
        uint256 submittedAt;
        uint256 revealedAt;
    }

    struct Dispute {
        bytes32 id;
        address creator;
        string title;
        uint256 approveVotes;
        uint256 rejectVotes;
        bool resolved;
        uint256 createdAt;
        uint256 votingDeadline;
    }

    // One committee member's recorded judgment on one bid — majority (2 of
    // 3) of these decides qualification, computed on-chain in
    // isBidQualified rather than trusted from an app-supplied boolean.
    struct Vote {
        bool preliminaryPass;
        bool qualificationPass;
        bool voted;
    }

    // ── State ───────────────────────────────────────────────────────────
    mapping(bytes32 => Tender) public tenders;
    mapping(bytes32 => bytes32[]) public tenderBidIds;
    mapping(bytes32 => Bid) public bidsById;
    mapping(bytes32 => Dispute) public disputes;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    mapping(address => bool) public registeredSuppliers;

    // Evaluation Committee: proposed by the tender's creator (Art.
    // 3(18)/3(19) — Procurement Official), approved by an authorized
    // Director distinct from the proposer (Art. 23's maker-checker split).
    mapping(bytes32 => address[3]) public committeeMembers;
    mapping(bytes32 => address) public committeeProposer;
    mapping(bytes32 => bool) public committeeApproved;
    mapping(bytes32 => mapping(bytes32 => mapping(address => Vote))) public votes;

    // Director allowlist — mirrors the app-layer allowlist this prototype
    // already used for Minister/Director approval; kept as an explicit
    // mapping rather than extending the Role enum, so existing role
    // numbering (and everything that depends on it) doesn't shift.
    mapping(address => bool) public authorizedDirectors;

    bytes32[] public tenderIds;
    bytes32[] public disputeIds;
    uint256 public totalRecords;

    uint256 public constant VOTE_THRESHOLD = 10;
    uint256 public constant APPROVAL_RATE = 60; // 60%

    // ── Tender Operations ───────────────────────────────────────────────

    function createTender(
        string calldata title,
        uint256 budget,
        uint256 deadline
    ) external returns (bytes32 tenderId) {
        tenderId = keccak256(abi.encodePacked(title, msg.sender, block.timestamp));

        tenders[tenderId] = Tender({
            id: tenderId,
            creator: msg.sender,
            title: title,
            budget: budget,
            deadline: deadline,
            published: false,
            awarded: false,
            createdAt: block.timestamp
        });

        tenderIds.push(tenderId);
        totalRecords++;
        emit TenderCreated(tenderId, msg.sender, title, budget, deadline);
    }

    function publishTender(bytes32 tenderId) external {
        Tender storage t = tenders[tenderId];
        require(t.creator == msg.sender, "Only creator can publish");
        require(!t.published, "Already published");
        t.published = true;
        totalRecords++;
        emit TenderPublished(tenderId, msg.sender);
    }

    // ── Bid Operations (commit-reveal) ─────────────────────────────────

    /// @notice Submit a sealed bid: only the commitment hash is stored, never the amount.
    function commitBid(bytes32 tenderId, bytes32 commitment) external returns (bytes32 bidId) {
        Tender storage t = tenders[tenderId];
        require(t.published, "Tender not published");
        require(!t.awarded, "Tender already awarded");
        require(block.timestamp <= t.deadline, "Deadline passed");

        bidId = keccak256(abi.encodePacked(tenderId, msg.sender, commitment, block.timestamp));

        bidsById[bidId] = Bid({
            id: bidId,
            tenderId: tenderId,
            bidder: msg.sender,
            commitment: commitment,
            amount: 0,
            revealed: false,
            submittedAt: block.timestamp,
            revealedAt: 0
        });
        tenderBidIds[tenderId].push(bidId);

        totalRecords++;
        emit BidCommitted(tenderId, bidId, msg.sender, commitment);
    }

    /// @notice Reveal a sealed bid after the deadline. Reverts if (amount, salt)
    /// doesn't recompute to the stored commitment — integrity enforced on-chain,
    /// not by trusting the app to check honestly.
    function revealBid(bytes32 tenderId, bytes32 bidId, uint256 amount, bytes32 salt) external {
        Tender storage t = tenders[tenderId];
        require(block.timestamp > t.deadline, "Reveal opens after deadline");
        Bid storage b = bidsById[bidId];
        require(b.tenderId == tenderId, "Bid not found for this tender");
        require(b.bidder == msg.sender, "Only the bidder can reveal their own bid");
        require(!b.revealed, "Already revealed");
        require(keccak256(abi.encode(amount, salt)) == b.commitment, "Reveal does not match commitment");

        b.amount = amount;
        b.revealed = true;
        b.revealedAt = block.timestamp;

        totalRecords++;
        emit BidRevealed(tenderId, bidId, msg.sender, amount);
    }

    /// @notice Single-Source only (Art. 3(10)) — nothing to seal against with one party.
    function submitBidDirect(bytes32 tenderId, uint256 amount) external returns (bytes32 bidId) {
        Tender storage t = tenders[tenderId];
        require(t.published, "Tender not published");
        require(!t.awarded, "Tender already awarded");

        bidId = keccak256(abi.encodePacked(tenderId, msg.sender, amount, block.timestamp));

        bidsById[bidId] = Bid({
            id: bidId,
            tenderId: tenderId,
            bidder: msg.sender,
            commitment: bytes32(0),
            amount: amount,
            revealed: true,
            submittedAt: block.timestamp,
            revealedAt: block.timestamp
        });
        tenderBidIds[tenderId].push(bidId);

        totalRecords++;
        emit BidCommitted(tenderId, bidId, msg.sender, bytes32(0));
        emit BidRevealed(tenderId, bidId, msg.sender, amount);
    }

    function getBidCount(bytes32 tenderId) external view returns (uint256) {
        return tenderBidIds[tenderId].length;
    }

    function getBid(bytes32 tenderId, uint256 index) external view returns (
        bytes32 bidId, address bidder, bool revealed, uint256 amount, uint256 submittedAt
    ) {
        Bid storage b = bidsById[tenderBidIds[tenderId][index]];
        return (b.id, b.bidder, b.revealed, b.revealed ? b.amount : 0, b.submittedAt);
    }

    // ── Evaluation Committee (Art. 3(18)/3(19)/23(1)-(2)) ───────────────

    /// @notice Propose the 3-member committee. Only the tender's creator (Procurement Official).
    function proposeCommittee(bytes32 tenderId, address[3] calldata members) external {
        Tender storage t = tenders[tenderId];
        require(t.creator == msg.sender, "Only the tender creator can propose a committee");
        require(!committeeApproved[tenderId], "Committee already approved");
        require(members[0] != address(0) && members[1] != address(0) && members[2] != address(0), "All three seats required");
        require(members[0] != members[1] && members[1] != members[2] && members[0] != members[2], "Committee seats must be distinct addresses");

        committeeMembers[tenderId] = members;
        committeeProposer[tenderId] = msg.sender;
        totalRecords++;
        emit CommitteeProposed(tenderId, msg.sender, members[0], members[1], members[2]);
    }

    /// @notice Approve the proposed committee. Only an authorized Director, distinct from the proposer.
    function approveCommittee(bytes32 tenderId) external {
        require(authorizedDirectors[msg.sender], "Not an authorized Director");
        require(msg.sender != committeeProposer[tenderId], "Cannot approve your own proposal");
        address[3] memory m = committeeMembers[tenderId];
        require(m[0] != address(0), "No committee proposed");
        require(!committeeApproved[tenderId], "Already approved");

        committeeApproved[tenderId] = true;
        totalRecords++;
        emit CommitteeApproved(tenderId, msg.sender);
    }

    function isCommitteeMember(bytes32 tenderId, address account) public view returns (bool) {
        address[3] memory m = committeeMembers[tenderId];
        return account == m[0] || account == m[1] || account == m[2];
    }

    /// @notice A committee member records their own preliminary/qualification judgment for one bid.
    function voteOnBid(bytes32 tenderId, bytes32 bidId, bool preliminaryPass, bool qualificationPass) external {
        Tender storage t = tenders[tenderId];
        require(committeeApproved[tenderId], "Committee not approved");
        require(isCommitteeMember(tenderId, msg.sender), "Not a committee member for this tender");
        require(block.timestamp > t.deadline, "Voting opens after the deadline");

        votes[tenderId][bidId][msg.sender] = Vote(preliminaryPass, qualificationPass, true);
        totalRecords++;
        emit BidVoted(tenderId, bidId, msg.sender, preliminaryPass, qualificationPass);
    }

    /// @notice 2-of-3 majority of recorded committee votes — computed here, not trusted from the app.
    function isBidQualified(bytes32 tenderId, bytes32 bidId) public view returns (bool) {
        address[3] memory m = committeeMembers[tenderId];
        uint256 prelimYes;
        uint256 qualYes;
        // Threshold is 2 of the fixed 3 committee seats — not 2 of however
        // many happened to vote. A single early "yes" must never look like
        // a majority just because nobody else has voted yet.
        for (uint256 i = 0; i < 3; i++) {
            Vote storage v = votes[tenderId][bidId][m[i]];
            if (v.voted) {
                if (v.preliminaryPass) prelimYes++;
                if (v.qualificationPass) qualYes++;
            }
        }
        return prelimYes >= 2 && qualYes >= 2;
    }

    // ── Award ───────────────────────────────────────────────────────────

    /// @notice Computes the winner itself (lowest revealed amount among committee-qualified
    /// bids — Art. 22(5) Lowest Evaluated Bid / Rule 19(7) RFQ) rather than accepting a
    /// vendor/amount the caller supplies. Callable by anyone once the deadline has passed —
    /// the outcome is deterministic from on-chain data, so no single party needs to be
    /// trusted to even trigger it, and none can block it by simply not calling.
    /// @dev Services/QCBS's weighted technical+financial scoring is not yet implemented
    /// on-chain (see MemberEvalInput.technicalScore in the app) — this covers the
    /// lowest-price methods only (Open/Restricted Bidding, RFQ).
    function finalizeAward(bytes32 tenderId) external {
        Tender storage t = tenders[tenderId];
        require(t.published, "Tender not published");
        require(!t.awarded, "Already awarded");
        require(block.timestamp > t.deadline, "Deadline not passed");

        bytes32[] memory ids = tenderBidIds[tenderId];
        uint256 lowestAmount = type(uint256).max;
        bytes32 winnerId;
        address winnerAddr;

        for (uint256 i = 0; i < ids.length; i++) {
            Bid storage b = bidsById[ids[i]];
            if (b.revealed && isBidQualified(tenderId, b.id) && b.amount < lowestAmount) {
                lowestAmount = b.amount;
                winnerId = b.id;
                winnerAddr = b.bidder;
            }
        }
        require(winnerAddr != address(0), "No qualified revealed bid");

        t.awarded = true;
        totalRecords++;
        emit ContractAwarded(tenderId, winnerId, winnerAddr, lowestAmount);
    }

    // ── Payment ─────────────────────────────────────────────────────────

    function recordPayment(bytes32 contractId, uint256 milestoneId, uint256 amount) external {
        totalRecords++;
        emit PaymentProcessed(contractId, milestoneId, amount);
    }

    // ── DAO Dispute Resolution ──────────────────────────────────────────

    function createDispute(string calldata title) external returns (bytes32 disputeId) {
        disputeId = keccak256(abi.encodePacked(title, msg.sender, block.timestamp));

        disputes[disputeId] = Dispute({
            id: disputeId,
            creator: msg.sender,
            title: title,
            approveVotes: 0,
            rejectVotes: 0,
            resolved: false,
            createdAt: block.timestamp,
            votingDeadline: block.timestamp + 7 days
        });

        disputeIds.push(disputeId);
        totalRecords++;
        emit DisputeCreated(disputeId, msg.sender, title);
    }

    function castVote(bytes32 disputeId, bool approve) external {
        Dispute storage d = disputes[disputeId];
        require(!d.resolved, "Already resolved");
        require(block.timestamp <= d.votingDeadline, "Voting ended");
        require(!hasVoted[disputeId][msg.sender], "Already voted");

        hasVoted[disputeId][msg.sender] = true;

        if (approve) {
            d.approveVotes++;
        } else {
            d.rejectVotes++;
        }

        emit VoteCast(disputeId, msg.sender, approve);

        // Auto-resolve if threshold reached
        uint256 total = d.approveVotes + d.rejectVotes;
        if (total >= VOTE_THRESHOLD) {
            uint256 rate = (d.approveVotes * 100) / total;
            d.resolved = true;
            totalRecords++;
            emit DisputeResolved(disputeId, rate >= APPROVAL_RATE, rate);
        }
    }

    // ── Whistleblower ───────────────────────────────────────────────────

    function submitWhistleblowerReport(
        bytes32 zkProofHash,
        string calldata category,
        string calldata severity
    ) external returns (bytes32 reportId) {
        reportId = keccak256(abi.encodePacked(zkProofHash, msg.sender, block.timestamp));
        totalRecords++;
        emit WhistleblowerReport(reportId, zkProofHash, category, severity);
    }

    // ── Supplier Registration ───────────────────────────────────────────

    function registerSupplier(string calldata companyName) external {
        require(!registeredSuppliers[msg.sender], "Already registered");
        registeredSuppliers[msg.sender] = true;
        totalRecords++;
        emit SupplierRegistered(msg.sender, companyName);
    }

    // ── View Helpers ────────────────────────────────────────────────────

    function getTenderCount() external view returns (uint256) {
        return tenderIds.length;
    }

    function getDisputeCount() external view returns (uint256) {
        return disputeIds.length;
    }
}
