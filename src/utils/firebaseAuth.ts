// Firebase Auth — anonymous sign-in only. No login screen, no user-facing
// change: every visitor silently gets an anonymous UID on first load, which
// is enough for the Realtime Database security rules to require
// `auth != null` on writes (closing the "anyone with the database URL can
// write" vulnerability) without adding any real account system.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBvBe77IvK9A4p6LmpfpqjHGKAPV34TyO0',
  authDomain: 'blockchain-based-procurement.firebaseapp.com',
  databaseURL: 'https://blockchain-based-procurement-default-rtdb.firebaseio.com',
  projectId: 'blockchain-based-procurement',
  storageBucket: 'blockchain-based-procurement.firebasestorage.app',
  messagingSenderId: '956127533047',
  appId: '1:956127533047:web:4498483c0838858c9ec0f2',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Cached so every caller (loadSharedState, saveSharedState, submitFeedback)
// can safely await this without re-triggering sign-in on every call — the
// underlying signInAnonymously() call only ever happens once per page load.
let authReady: Promise<User> | null = null;

function ensureAnonymousAuth(): Promise<User> {
  if (!authReady) {
    authReady = new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        }
      }, reject);
      // Only kick off a new sign-in if nothing is already signed in —
      // onAuthStateChanged above will fire once persistence has restored
      // a prior session, if any.
      if (!auth.currentUser) {
        signInAnonymously(auth).catch(reject);
      }
    });
  }
  return authReady;
}

// Realtime Database's REST API (plain fetch, not the SDK's own read/write
// calls) has no notion of Firebase Auth state unless the current ID token
// is attached to each request as the `auth` query parameter — this doesn't
// happen automatically. getIdToken() returns the cached token and
// transparently refreshes it in the background once it's close to the
// hourly expiry, so callers don't need their own refresh logic.
export async function getAuthQueryParam(): Promise<string> {
  const user = await ensureAnonymousAuth();
  const token = await user.getIdToken();
  return `auth=${token}`;
}
