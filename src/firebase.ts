import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

// Mesmas credenciais do projeto Firebase do Didi Gás (mesmo .env que lá,
// ou copie os valores do console do Firebase caso use um projeto separado)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)

const didiGasConfig = {
  apiKey: import.meta.env.VITE_DIDI_GAS_API_KEY,
  authDomain: import.meta.env.VITE_DIDI_GAS_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_DIDI_GAS_PROJECT_ID,
  storageBucket: import.meta.env.VITE_DIDI_GAS_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_DIDI_GAS_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_DIDI_GAS_APP_ID,
}

export const didiGasApp = initializeApp(didiGasConfig, 'didi-gas')
export const didiGasDb = getFirestore(didiGasApp)

// Nome da coleção de vendas do Didi Gás — troque aqui se não for "vendas"
export const SALES_COLLECTION = import.meta.env.VITE_SALES_COLLECTION || 'vendas'

// Nome da coleção nova de despesas (criada por este app)
export const EXPENSES_COLLECTION = 'despesas'

// Nome da coleção de receitas manuais (criada por este app)
export const REVENUES_COLLECTION = 'receitas'
