// Google sign-in via Firebase Auth. Inert until VITE_FIREBASE_* is set (root .env).
let authPromise = null;

export function googleConfigured() {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

export async function googleIdToken() {
  if (!googleConfigured()) throw new Error('Google sign-in not configured (set VITE_FIREBASE_* in .env)');
  if (!authPromise) {
    authPromise = (async () => {
      const { initializeApp } = await import('firebase/app');
      const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const app = initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      });
      return { auth: getAuth(app), GoogleAuthProvider, signInWithPopup };
    })();
  }
  const { auth, GoogleAuthProvider, signInWithPopup } = await authPromise;
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return result.user.getIdToken();
}
