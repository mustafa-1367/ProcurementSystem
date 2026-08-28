// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProcurementSystem — On-chain procurement registry with DAO voting
/// @notice Stores tenders, bids, awards, payments, disputes, and whistleblower reports on-chain
contract ProcurementSystem {

    // ── Events ──────────────────────────────────────────────────────────
    event TenderCreated(bytes32 indexed tenderId, address indexed creator, string title, uint256 budget, uint256 deadline);
    event TenderPublished(bytes32 indexed tenderId, address indexed publisher);
    event BidSubmitted(bytes32 indexed tenderId, bytes32 indexed bidId, address indexed bidder, uint256 amount);
    event ContractAwarded(bytes32 indexed tenderId, bytes32 indexed bidId, address indexed vendor, uint256 amount);
    event PaymentProcessed(bytes32 indexed contractId, uint256 milestoneId, uint256 amount);
    event DisputeCreated(bytes32 indexed disputeId, address indexed creator, string title);
    event VoteCast(bytes32 indexed disputeId, address indexed voter, bool approve);
    event DisputeResolved(bytes32 indexed disputeId, bool approved, uint256 approvalRate);
    event WhistleblowerReport(bytes32 indexed reportId, bytes32 zkProofHash, string category, string severity);
    event SupplierRegistered(address indexed supplier, string companyName);

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

    struct Bid {
        bytes32 id;
        bytes32 tenderId;
        address bidder;
        uint256 amount;
        uint256 submittedAt;
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

    // ── State ───────────────────────────────────────────────────────────
    mapping(bytes32 => Tender) public tenders;
    mapping(bytes32 => Bid[]) public tenderBids;
    mapping(bytes32 => Dispute) public disputes;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    mapping(address => bool) public registeredSuppliers;

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

    // ── Bid Operations ──────────────────────────────────────────────────

    function submitBid(bytes32 tenderId, uint256 amount) external returns (bytes32 bidId) {
        Tender storage t = tenders[tenderId];
        require(t.published, "Tender not published");
        require(!t.awarded, "Tender already awarded");
        require(block.timestamp <= t.deadline, "Deadline passed");

        bidId = keccak256(abi.encodePacked(tenderId, msg.sender, amount, block.timestamp));

        tenderBids[tenderId].push(Bid({
            id: bidId,
            tenderId: tenderId,
            bidder: msg.sender,
            amount: amount,
            submittedAt: block.timestamp
        }));

        totalRecords++;
        emit BidSubmitted(tenderId, bidId, msg.sender, amount);
    }

    function getBidCount(bytes32 tenderId) external view returns (uint256) {
        return tenderBids[tenderId].length;
    }

    // Bids are sealed until deadline passes
    function getBid(bytes32 tenderId, uint256 index) external view returns (
        bytes32 bidId, address bidder, uint256 amount, uint256 submittedAt
    ) {
        Tender storage t = tenders[tenderId];
        require(block.timestamp > t.deadline, "Bids sealed until deadline");
        Bid storage b = tenderBids[tenderId][index];
        return (b.id, b.bidder, b.amount, b.submittedAt);
    }

    // ── Award ───────────────────────────────────────────────────────────

    function awardContract(bytes32 tenderId, bytes32 bidId, address vendor, uint256 amount) external {
        Tender storage t = tenders[tenderId];
        require(t.creator == msg.sender, "Only creator can award");
        require(t.published, "Tender not published");
        require(!t.awarded, "Already awarded");
        t.awarded = true;
        totalRecords++;
        emit ContractAwarded(tenderId, bidId, vendor, amount);
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
