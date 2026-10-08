// Evaluation Committee document verification — Art. 3(18)/3(19)/23(1)-(2).
//
// Two different kinds of checks exist here, and they're deliberately handled
// differently:
//
// 1. Business license and bank guarantee are lookups against a known
//    registry (mocked here — see demoData.ts's honesty note on why a mock
//    is the right stand-in, not a shortcut). A lookup needs no human
//    judgment, so these are computed automatically and shown read-only —
//    making an evaluator manually re-type something a registry already
//    proves would be pointless busywork, not an integrity improvement.
//
// 2. Bank statements and other supporting documents require a human to
//    actually read them — there is no registry to check them against. Those
//    stay as individually-attributed checkboxes per committee member (see
//    committeeAttestations state in App.tsx), never auto-ticked.

import { mockBankGuarantees } from '../data/demoData';

// ── Minister/Director authorization ────────────────────────────────────
//
// Earlier, approval only checked that the connected wallet *differed* from
// whoever proposed the committee — which stops one person self-approving,
// but doesn't stop anyone with a second free MetaMask address from claiming
// to be "the Minister/Director." That's not a real authorization check.
//
// This is the real check: the approving wallet must be on an explicit
// allowlist of addresses recognized as holding Minister/Director authority
// — mocked here the same way the AISA license registry and bank-guarantee
// registry are mocked, because no real system exists yet to query. In a
// real deployment this list would be populated the same way the contract's
// `assignRole()` already gates Government/Auditor/Oversight roles: by a
// trusted administrator, not by self-declaration.
const AUTHORIZED_DIRECTOR_ADDRESSES = [
  '0x15bFf92fe34e25633dc2F91834EE6d921002f55F'.toLowerCase(),
];

export function isAuthorizedDirector(address: string | null | undefined): boolean {
  if (!address) return false;
  return AUTHORIZED_DIRECTOR_ADDRESSES.includes(address.toLowerCase());
}

export interface LicenseCheckResult {
  verified: boolean;
  registrationNumber?: string;
  reason: string;
}

// Re-checks live against the registration record rather than trusting a
// snapshot from registration day — a license or debarment status can change
// between when a company registered and when a specific tender evaluates
// their bid.
export function verifyBusinessLicense(companyName: string, registeredSuppliers: any[]): LicenseCheckResult {
  const supplier = registeredSuppliers.find(
    (s) => s.companyName?.toLowerCase().trim() === companyName?.toLowerCase().trim()
  );
  if (!supplier) {
    return { verified: false, reason: 'No e-KYC registration found for this company' };
  }
  if (supplier.checks?.notDebarred === false) {
    return { verified: false, registrationNumber: supplier.registrationNumber, reason: 'Company is on the debarment list' };
  }
  if (!supplier.checks?.businessRegistration || !supplier.registrationNumber) {
    return { verified: false, reason: 'No valid business registration on file' };
  }
  return { verified: true, registrationNumber: supplier.registrationNumber, reason: 'Valid registration, not debarred' };
}

export interface GuaranteeCheckResult {
  verified: boolean;
  bank?: string;
  referenceNumber?: string;
  amount?: number;
  reason: string;
}

export function verifyBankGuarantee(companyName: string, requiredAmount?: number): GuaranteeCheckResult {
  const entry = mockBankGuarantees.find(
    (g) => g.companyName.toLowerCase().trim() === companyName?.toLowerCase().trim()
  );
  if (!entry) {
    return { verified: false, reason: 'No bank guarantee on file for this company' };
  }
  if (new Date(entry.expiryDate).getTime() < Date.now()) {
    return { verified: false, bank: entry.bank, referenceNumber: entry.referenceNumber, amount: entry.amount, reason: `Guarantee expired ${entry.expiryDate}` };
  }
  if (requiredAmount && entry.amount < requiredAmount) {
    return { verified: false, bank: entry.bank, referenceNumber: entry.referenceNumber, amount: entry.amount, reason: `Guarantee amount (${entry.amount.toLocaleString()} AFN) below required bid security` };
  }
  return { verified: true, bank: entry.bank, referenceNumber: entry.referenceNumber, amount: entry.amount, reason: 'Guarantee on file, not expired, amount sufficient' };
}
