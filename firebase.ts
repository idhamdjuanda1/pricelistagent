import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

type Env = Record<string, string | undefined>
const env = (import.meta as any).env as unknown as Env

function mustGetAny(keys: string[], label: string): string {
  for (const k of keys) {
    const v = env[k]
    if (v && String(v).length) return String(v)
  }
  throw new Error(`[firebase] Missing ENV for ${label}. Provide one of: ${keys.join(', ')}`)
}

const firebaseConfig = {
  apiKey: mustGetAny(['VITE_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY'], 'API Key'),
  authDomain: mustGetAny(['VITE_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'], 'Auth Domain'),
  projectId: mustGetAny(['VITE_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'], 'Project ID'),
  storageBucket: mustGetAny(['VITE_FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'], 'Storage Bucket'),
  messagingSenderId: mustGetAny(['VITE_FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'], 'Messaging Sender ID'),
  appId: mustGetAny(['VITE_FIREBASE_APP_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID'], 'App ID'),
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
