# Decentralized Public E-Procurement Ecosystem

A full-stack decentralized application (dApp) that brings transparency and accountability to public procurement, with Afghanistan as a running case. Built as a dApp, it implements the complete procurement lifecycle on the Ethereum blockchain — from tender creation to contract execution — aligned with the Afghan National Procurement Law.

**[Live Demo](https://mustafa-1367.github.io/ProcurementSystem/)**

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
- **Wallet Authentication** via MetaMask — on-chain role verification (Citizen, Supplier, Government, Auditor, Oversight)
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
