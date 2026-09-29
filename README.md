# Decentralized Public E-Procurement Ecosystem

A full-stack decentralized application (dApp) that brings transparency and accountability to public procurement, with Afghanistan as a running case. It implements the complete procurement lifecycle on the Ethereum blockchain — from tender creation to contract execution — aligned with the Afghan National Procurement Law.

**[Live Demo](https://mustafa-1367.github.io/ProcurementSystem/)**

> **Research proof-of-concept.** This repository is a research prototype built to support an academic manuscript's design-science evaluation (RQ2). It is **not** a production procurement platform: several subsystems are simplified, simulated, or client-side-only by design. See [Implementation status](#implementation-status-v1-vs-v2) below for exactly what is real vs. simulated in each version, verified against this codebase.

---

## Implementation status (v1 vs. v2)

**v1 and v2 are two separate repositories, not two states of this one.** v1 is [`saaysalim/ProcurementSystem`](https://github.com/saaysalim/ProcurementSystem), the codebase used in the paper's stakeholder evaluation (27 April – 17 May 2026) — its only deployment is commit [`96dba4c`](https://github.com/saaysalim/ProcurementSystem/commit/96dba4c137f5e61fa11215060cf6595d7bd661a4) ("Deploy site," 2025-12-13 20:06:24 UTC, live at `saaysalim.github.io/ProcurementSystem`), built from source commit [`de4bd5c`](https://github.com/saaysalim/ProcurementSystem/commit/de4bd5c028c93c5c2a460ee1b25e3fb83946d626); neither branch was ever updated again. **v2 is this repository**, `mustafa-1367/ProcurementSystem`, forked from that same `de4bd5c` commit and actively developed from August 2026 onward, adding real blockchain integration at [`7bb65cf`](https://github.com/mustafa-1367/ProcurementSystem/commit/7bb65cf49f77ccf1ded2a5204d67121588824314). Because `de4bd5c` is the shared fork point, the v1 column below is verified directly against that commit's code (identical in both repositories); the v2 column is verified against this repository's current `main`.

| Subsystem | v1 | v2 |
|---|---|---|
| **Data persistence** | Browser memory only (React `useState`) — no database, no cross-session/cross-device visibility. Refreshing the page or opening on a second machine loses/hides all entered data. | Firebase Realtime Database (`src/utils/sharedStorage.ts`) — unauthenticated REST `fetch()`, 500ms-debounced whole-document overwrite. Shared and cross-device, but **no auth on the database itself** (see note below). |
| **Bid confidentiality** | UI-only sealing (no smart contracts existed yet). | **"Sealed," not encrypted.** The bid `amount` is stored as a plain `uint256` in `contracts/ProcurementSystem.sol`'s `Bid` struct — visible to anyone reading chain state directly. Only the `getBid()` **getter function** is access-controlled: `require(block.timestamp > t.deadline, "Bids sealed until deadline")` (line ~166). No cryptographic hiding of the value exists at any point. |
| **Whistleblower ZKP** | Not implemented. | Real Groth16 circuit (`circuits/whistleblower.circom`) and on-chain verifier (`WhistleblowerVerifier.sol` + `Groth16Verifier.sol`). **However**, `submitVerifiedReport()` sets `currentMerkleRoot = bytes32(merkleRoot)` from the **caller-supplied** parameter, unconditionally, before verifying the proof against that same self-supplied root — it never checks the proof against an owner-controlled, pre-registered membership root. `registerCommitment()` and `updateMerkleRoot()` (the only owner-gated path) exist but are never consulted by `submitVerifiedReport()`. Net effect: the proof shows internal consistency ("this proof matches the root I supplied"), not membership in an authoritative registered set. |
| **Payments** | No smart contracts. | Milestone payments update a status field and emit `PaymentProcessed` via `recordPayment()` (`ProcurementSystem.sol`, ~line 187) — **no token transfer occurs**. A separate ERC-20 `ProcToken.sol` is deployed with working `transfer()`/`transferFrom()`, but is never called anywhere in the frontend; balances never move. |
| **DAO voting** | Not implemented. | Real on-chain `createDispute()`/`castVote()` with on-chain quorum/threshold auto-resolve (`VOTE_THRESHOLD`, `APPROVAL_RATE` in `ProcurementSystem.sol`). |
| **Smart contracts deployed (Sepolia)** | None. | 4 contracts: `ProcurementSystem`, `ProcToken`, `WhistleblowerVerifier`, `Groth16Verifier` (addresses below). |
| **Audit dashboard** | Simulated data only. | Reads real on-chain events when a wallet is connected; falls back to local simulation otherwise, with on-chain/simulated status labeled in the UI per record. |
| **Citizen incentive tokens** | Not implemented. | Reward amounts are tracked and displayed in-app via a local, in-memory simulated ledger (`blockchain.ts`'s `BlockchainService.addBlock()`) — **not** the deployed `ProcToken` ERC-20 contract. Resets on page reload; no real token custody. |

---

## Why This Exists

Public procurement faces systemic issues: opaque bid evaluations, contract manipulation, and limited public oversight. This dApp demonstrates how blockchain technology can enforce transparency at every stage — making every tender, bid, evaluation, and payment verifiable on-chain.

## Key Features

### Procurement Lifecycle (On-Chain)
- **Pre-Tender Phase** — Needs assessment, budget planning, tender document preparation
- **Tendering Phase** — Sealed bid submission, deadline enforcement, automatic unsealing
- **Post-Tender Phase** — 4-stage bid evaluation (Preliminary → Technical → Financial → Combined Score), evaluation report generation, 7-day standstill period, protest/appeal system, milestone-based contract payments

### Blockchain & Web3
- **Smart Contracts** on Ethereum (Sepolia testnet) — role management, procurement records, token-based payments
- **Wallet Authentication** via MetaMask — on-chain role verification (Supplier, Government, Auditor, Oversight)
- **Immutable Audit Trail** — every action (tender publish, bid submit, evaluation, payment) recorded on-chain

### Zero-Knowledge Proofs (ZKP)
- **Groth16 proving system** — Whistleblower reports are protected by ZKP, allowing users to prove they are registered members without revealing their identity
- **Circom circuit** (`circuits/whistleblower.circom`) — implements Poseidon-based Merkle tree membership proof (8 levels, up to 256 users)
- **Browser-based proof generation** — snarkjs + circomlibjs generate Groth16 proofs entirely client-side, no trusted server needed
- **On-chain verification** — `WhistleblowerVerifier.sol` verifies proofs on Ethereum via `Groth16Verifier.sol` (auto-generated from the circuit's trusted setup)
- **Nullifier-based double-report prevention** — each report produces a unique nullifier hash (`Poseidon(secret, secret)`); the smart contract rejects duplicate nullifiers, preventing the same secret from submitting twice
- **Flow:** User secret → Poseidon commitment → Merkle tree leaf → Groth16 proof (merkleRoot + nullifierHash as public signals) → on-chain verification → anonymous report recorded

### Governance & Accountability
- **Public Audit Dashboard** — real-time transparency for citizens
- **Whistleblower Portal** — anonymous corruption reporting with ZKP protection
- **Reputation System** — supplier track record scoring
- **DAO Governance** — community-driven dispute voting, complaint oversight, routing to Evaluation Committee
- **Dispute Resolution** — formal protest mechanism during standstill period, objection → NPA vote → Evaluation Committee re-review

### Compliance
- **Bidder Eligibility (KYC)** — registration, tax clearance, debarment checks per Afghan Procurement Law Art. 17
- **Sealed Bidding** — bids encrypted until deadline passes
- **Standstill Period** — mandatory 7-day window before contract finalization (per international best practice)
- **Multi-language** — English, Dari, Pashto

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Recharts |
| Blockchain | Solidity, Hardhat, Ethers.js v6 |
| ZKP | Circom 2.0, snarkjs (Groth16), circomlibjs (Poseidon hash) |
| Network | Ethereum Sepolia Testnet |
| Wallet | MetaMask Integration |
| State | Firebase Realtime Database |
| Build | Vite, GitHub Pages |

## Architecture

```
User (MetaMask Wallet)
    │
    ├── React Frontend ──── Firebase (shared state)
    │       │
    │       └── snarkjs (browser) ── Groth16 proof generation
    │
    └── Ethereum Blockchain
            ├── ProcurementSystem.sol (roles, records, tenders)
            ├── ProcToken.sol (ERC-20 payment token)
            ├── WhistleblowerVerifier.sol (ZKP report verification)
            └── Groth16Verifier.sol (on-chain proof verifier)
```

**5 Independent Roles:** Each role has its own dashboard and permissions, verified on-chain:

| Role | Access |
|------|--------|
| Procuring Entity | Create tenders, evaluate bids, award contracts, process payments |
| Supplier/Bidder | Register (KYC), submit bids, track contracts, file protests |
| Public/Citizen | View all tenders, audit trail, whistleblower portal |
| Auditor | Independent audit access, compliance monitoring |
| Oversight | Regulatory oversight, system-wide visibility |

## Design requirements (DR1–DR8) → prototype component

Derived from the manuscript's Trust-Participation Determinants Framework (Table 5/6). Version column reflects code-verified status — v1 against [`saaysalim/ProcurementSystem`](https://github.com/saaysalim/ProcurementSystem) (commit `de4bd5c`), v2 against this repository.

| DR | Requirement | Prototype component | Version |
|---|---|---|---|
| DR1 | Intuitive, accessible interfaces | Accessibility panel, 3-language i18n (`src/locales/`), responsive layout | v2 (v1: web UI only, no accessibility/i18n layer) |
| DR2 | Data privacy, security, whistleblower protection | `WhistleblowerPortal.tsx`, `circuits/whistleblower.circom`, `WhistleblowerVerifier.sol` | v2 only — see membership-root caveat above |
| DR3 | Transparent, verifiable procurement information | `PublicAuditDashboard.tsx`, `BlockchainDashboard.tsx` | v1: simulated only. v2: real on-chain reads, labeled on-chain/simulated per record |
| DR4 | Inclusive participation mechanisms | Covered under DR1 (i18n/UI) only | Neither version has an external-facing API layer |
| DR5 | Feedback mechanisms, institutional responsiveness | `FeedbackWidget.tsx` | Renders a submission form only — no network request or persistence in either version |
| DR6 | Citizen empowerment through participation | `PublicAuditDashboard.tsx` (`handleCitizenVerify`), `ReputationSystem.tsx` | Audit dashboard functional (mock data) both versions; reputation scoring is client-side, not on-chain; token reward contract (`ProcToken.sol`) exists but is never invoked |
| DR7 | Compliant legal/regulatory framework | `DAOGovernance.tsx` (`castVote`), `PostTenderingPhase.tsx` (Art. 43/44 evaluation logic) | v2: DAO voting is real on-chain with quorum enforcement. Legal compliance itself is UI-level deadline validation only — no debarment/sanctions screening |
| DR8 | High system reliability and service quality | `contracts/*.sol`, Hardhat deploy pipeline | v1: no smart contracts. v2: 4 Solidity contracts (v0.8.24) deployed on Sepolia |

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Compile smart contracts
npm run compile

# Deploy to local Hardhat node
npm run chain          # Terminal 1
npm run deploy:local   # Terminal 2

# Deploy to Sepolia testnet
npm run deploy:sepolia
```

### Requirements
- Node.js 18+
- MetaMask browser extension
- Sepolia testnet ETH ([PoW Faucet](https://sepolia-faucet.pk910.de/))

## Smart Contract Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| ProcurementSystem | `0x5D8ca4B7B3929624951c3AD321f3f09DF185b30E` |
| ProcToken (ERC-20) | `0xeA1694813ce93bdBA6CF3ad39Ff9a0fBFE0a5F6f` |
| WhistleblowerVerifier | `0xf3FC3eb93e38f3Be978Da0E5F1a24fD7fDb0E309` |
| Groth16Verifier | `0xF4a71E22c07187dF6eA8Bf689B24EEfdD57BF370` |

## Contributors

- **Mohammad Mustafa Ibrahimy** — [@mustafa-1367](https://github.com/mustafa-1367)

## License

MIT
