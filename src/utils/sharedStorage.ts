// Firebase Realtime Database - shared storage for multi-user access
// Replace FIREBASE_URL with your project's database URL

import { getAuthQueryParam } from './firebaseAuth';

const FIREBASE_URL = 'https://blockchain-based-procurement-default-rtdb.firebaseio.com';

const isConfigured = () => !FIREBASE_URL.includes('__FIREBASE_URL__');

// Debounce timer to avoid excessive writes
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadSharedState(): Promise<Record<string, any> | null> {
  if (!isConfigured()) return null;
  try {
    const auth = await getAuthQueryParam();
    const res = await fetch(`${FIREBASE_URL}/procurement.json?${auth}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data || null;
  } catch {
    return null;
  }
}

export type SaveStatus = 'saving' | 'saved' | 'error';

// Optional status callback — lets callers show real save-confirmation UI
// (e.g. committee members entering evaluation checkboxes/scores) instead of
// this being a pure fire-and-forget write. The write itself is unchanged:
// still debounced, still a single whole-document PUT, still silently
// swallows the error after reporting it (localStorage stays the fallback).
export function saveSharedState(state: Record<string, any>, onStatusChange?: (status: SaveStatus) => void): void {
  if (!isConfigured()) return;
  // Debounce: wait 500ms after last change before saving
  if (saveTimer) clearTimeout(saveTimer);
  onStatusChange?.('saving');
  saveTimer = setTimeout(async () => {
    try {
      const auth = await getAuthQueryParam();
      const res = await fetch(`${FIREBASE_URL}/procurement.json?${auth}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      onStatusChange?.(res.ok ? 'saved' : 'error');
    } catch {
      // Silent fail — localStorage still works as fallback — but the
      // caller now at least finds out, instead of assuming success.
      onStatusChange?.('error');
    }
  }, 500);
}

export function isSharedStorageConfigured(): boolean {
  return isConfigured();
}

export interface FeedbackEntry {
  category: 'bug' | 'feature' | 'question';
  email: string;
  message: string;
  attachmentNames: string[];
  submittedAt: string;
  page: string;
}

// Separate path, separate write pattern from the rest of this file — the
// procurement.json state above is a single whole-document overwrite (fine
// for one app's own state, actively wrong for feedback submitted by many
// different people at any time: two overwrites racing would silently drop
// one submitter's message). Firebase's POST-to-a-collection-path creates a
// new auto-ID child per call instead, so concurrent submissions can never
// clobber each other.
export async function submitFeedback(entry: Omit<FeedbackEntry, 'submittedAt' | 'page'>): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const auth = await getAuthQueryParam();
    const res = await fetch(`${FIREBASE_URL}/feedback.json?${auth}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...entry,
        submittedAt: new Date().toISOString(),
        page: typeof window !== 'undefined' ? window.location.href : '',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
