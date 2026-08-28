// Firebase Realtime Database - shared storage for multi-user access
// Replace FIREBASE_URL with your project's database URL

const FIREBASE_URL = 'https://blockchain-based-procurement-default-rtdb.firebaseio.com';

const isConfigured = () => !FIREBASE_URL.includes('__FIREBASE_URL__');

// Debounce timer to avoid excessive writes
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadSharedState(): Promise<Record<string, any> | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${FIREBASE_URL}/procurement.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data || null;
  } catch {
    return null;
  }
}

export function saveSharedState(state: Record<string, any>): void {
  if (!isConfigured()) return;
  // Debounce: wait 500ms after last change before saving
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fetch(`${FIREBASE_URL}/procurement.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
    } catch {
      // Silent fail — localStorage still works as fallback
    }
  }, 500);
}

export function isSharedStorageConfigured(): boolean {
  return isConfigured();
}
