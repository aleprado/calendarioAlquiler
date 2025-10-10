import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'

const requiredKeys = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'] as const

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missing = requiredKeys.filter((key) => !import.meta.env[key])
if (missing.length > 0) {
  console.warn(`Las siguientes variables de Firebase faltan en el entorno: ${missing.join(', ')}`)
}

let firebaseApp: FirebaseApp | null = null
let firebaseAuth: Auth | null = null

export const getFirebaseApp = () => {
  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig)
  }
  return firebaseApp
}

export const getFirebaseAuth = () => {
  if (!firebaseAuth) {
    firebaseAuth = getAuth(getFirebaseApp())
  }
  return firebaseAuth
}

export const googleProvider = new GoogleAuthProvider()
