# Authentication + Security Rules Setup

The repo ships with `firestore.rules` (small-team allowlist model) and an
auth-aware app shell wired but **not yet activated**. Follow this checklist
to switch from "open" to "locked".

## 1. Enable Google sign-in in Firebase

1. <https://console.firebase.google.com/project/ktm-logistics-b2309/authentication/providers>
2. Click **Google** under "Native providers" → **Enable** → set support email → Save
3. Sign in once with your own Google account at <https://killingthemains.github.io/Truck-Packer/>
   (this will require the in-app auth flow to be wired — see step 3 below)

## 2. Collect staff UIDs

After step 1, the Authentication → Users tab will list anyone who has
signed in. Copy each teammate's **UID** (long alphanumeric string) and
paste into `firestore.rules` inside the `isStaff()` allowlist array.

## 3. Wire the in-app auth flow

Not yet implemented. Suggested skeleton (`src/utils/auth.js`):

```js
import { lsGet, lsSet } from './storage.js';

export const signIn = async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  return firebase.auth().signInWithPopup(provider);
};

export const signOut = () => firebase.auth().signOut();

export const onAuthChange = (cb) => firebase.auth().onAuthStateChanged(cb);
```

Plus a small modal (`src/components/AuthGate.jsx`) that blocks the rest of
the app until `request.auth.uid` is set. Public dashboard URL can pass
`?public=1` to skip the gate (read-only views still work under the rules).

## 4. Deploy the rules

```bash
npx firebase login            # first time only
npx firebase init firestore   # one-time; pick firestore.rules when asked
npx firebase deploy --only firestore:rules --project ktm-logistics-b2309
```

## 5. Verify

In the Firebase Console → Firestore → Rules → **Playground**:
- As an **unauthenticated** request: should be denied on every doc except
  `/config/library`, `/config/currentShow`, and `/events/*/status/*`.
- As an **authenticated** request with UID in the allowlist: should be
  allowed everywhere.
- As an **authenticated** request *not* in the allowlist: should be denied.

## 6. Update the GAS public dashboard

Once rules are deployed, the public-dashboard Apps Script can still read
`/config/currentShow` and the relevant `events/{slug}/status` without auth.
No code change needed there.

## 7. Rollback (if anything breaks)

The simplest rollback is to redeploy a permissive rules file:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}
```

`firebase deploy --only firestore:rules` applies in seconds. Keep the
real `firestore.rules` in git so this is just a one-line revert.
