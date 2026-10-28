import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Lazy: returns null until FIREBASE_* service-account vars are set (see .env.example).
let app: App | null = null;
let attempted = false;

export function firebaseReady(): boolean {
  if (!attempted) {
    attempted = true;
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
      app = getApps()[0] ?? initializeApp({
        credential: cert({ projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }),
      });
    }
  }
  return app !== null;
}

export async function verifyGoogleToken(idToken: string) {
  if (!firebaseReady() || !app) return null;
  const decoded = await getAuth(app).verifyIdToken(idToken);
  return { uid: decoded.uid, email: (decoded.email || '').toLowerCase(), emailVerified: decoded.email_verified === true };
}
