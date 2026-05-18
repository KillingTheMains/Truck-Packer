// Google sign-in wrapper. The Firebase Auth compat SDK is loaded from a
// <script> in index.html so `firebase.auth()` is a global.
//
// The app uses a small-team allowlist enforced in firestore.rules:
// any signed-in user can reach the sign-in flow, but only allowlisted
// UIDs can actually read/write data. Non-staff users will see the
// sign-in screen succeed and then immediately get permission errors,
// which is intentional — we don't want to leak the user list by
// validating allowlist client-side.

export const signInWithGoogle = async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  // Force account chooser so a wrong-account sign-in is easy to correct.
  provider.setCustomParameters({ prompt: 'select_account' });
  return firebase.auth().signInWithPopup(provider);
};

export const signOut = () => firebase.auth().signOut();

// Subscribe to auth state. Returns an unsubscribe function.
export const onAuthChange = (cb) => firebase.auth().onAuthStateChanged(cb);

// Public dashboard pass-through. URLs like `?public=1` skip the sign-in
// screen entirely so the read-only status feed keeps working without auth.
// rules in firestore.rules already enforce read-only for unauthenticated.
export const isPublicMode = () => {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get('public') === '1';
  } catch (e) {
    return false;
  }
};
