import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean)
export const firebaseApp = firebaseConfigured
  ? getApps()[0] ?? initializeApp(firebaseConfig)
  : null
export const auth = firebaseApp ? getAuth(firebaseApp) : null
export const firestore = firebaseApp
  ? initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true })
  : null

export function firebaseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'An unexpected Firebase error occurred.'
}
