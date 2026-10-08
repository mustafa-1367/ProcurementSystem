// Commit-Reveal Sealed Bidding
//
// Fixes the gap documented in the README: bid amounts were labeled "Sealed &
// Encrypted" in the UI but were never actually hidden — they sat in plaintext
// in the `bids` array (and the unauthenticated Firebase mirror) from the
// moment of submission, and PostTenderingPhase had no deadline check, so a
// procuring-entity user could read every amount and award before the
// submission deadline even passed.
//
// Real scheme: at submission time the bidder publishes only a commitment
// hash of (amount, salt) — never the amount itself. The amount+salt pair is
// kept only in the bidder's own browser (localStorage) until the deadline
// passes, at which point the bidder reveals it; the app recomputes the hash
// and checks it matches what was committed before accepting the amount as
// the bid's price. A bid that is never revealed has no usable price and is
// excluded from evaluation — that's an intentional consequence of sealing,
// not a bug.
//
// Single-Source procurement is exempt: there is only one party and nothing
// to seal against, so those bids keep a plain amount as before.

import { keccak256, AbiCoder, randomBytes, hexlify } from 'ethers';

export interface BidSecret {
  amount: string;
  salt: string;
}

const SECRET_KEY_PREFIX = 'procurement_bid_secret_';

export function generateSalt(): string {
  return hexlify(randomBytes(32));
}

// keccak256(uint256 amount, bytes32 salt) — a one-way binding commitment.
// Knowing the commitment reveals nothing about the amount; only the party
// holding (amount, salt) can later prove what they committed to.
export function computeCommitment(amount: string | number, salt: string): string {
  const amountWei = BigInt(Math.round(Number(amount) || 0));
  const coder = AbiCoder.defaultAbiCoder();
  return keccak256(coder.encode(['uint256', 'bytes32'], [amountWei, salt]));
}

// The secret never leaves the bidder's own browser — it is not written to
// the shared bid record or to any blockchain call.
export function storeBidSecret(bidId: string, amount: string, salt: string): void {
  try {
    localStorage.setItem(SECRET_KEY_PREFIX + bidId, JSON.stringify({ amount, salt }));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — the bidder
    // will simply be unable to reveal this bid later, which is surfaced to
    // them at reveal time rather than silently failing here.
  }
}

export function getBidSecret(bidId: string): BidSecret | null {
  try {
    const raw = localStorage.getItem(SECRET_KEY_PREFIX + bidId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function verifyReveal(amount: string, salt: string, commitment: string): boolean {
  return computeCommitment(amount, salt) === commitment;
}

// Once revealed, the salt is published alongside the amount in the shared
// bid record (it's meant to become public at reveal time — that's how
// commit-reveal works). That lets ANY reader — an evaluator, an auditor, a
// citizen on the public dashboard — independently recompute the commitment
// and check it themselves, instead of only trusting the revealing bidder's
// own browser to have checked honestly. Returns null when there's nothing to
// verify (no commitment at all, e.g. Single-Source, or not revealed yet).
export function verifyRevealedBid(bid: { amount?: unknown; salt?: string; commitment?: string; revealed?: boolean }): boolean | null {
  if (!bid.commitment || !bid.revealed) return null;
  if (!bid.salt) return false;
  return verifyReveal(String(bid.amount), bid.salt, bid.commitment);
}
