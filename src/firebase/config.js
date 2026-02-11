import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Preferência: usar variáveis de ambiente para não expor segredos no código.
// Se estiver trabalhando localmente e não tiver as variáveis, preenchimentos
// derivados do arquivo de service account (somente campos públicos) foram
// inseridos abaixo para conveniência. NÃO comite credenciais sensíveis.

// Valores sensíveis devem sempre vir de variáveis de ambiente.
const projectIdFromServiceAccount = 'meu-treino-eleitos'; // extraído de meu-treino-eleitos-firebase-adminsdk-*.json

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectIdFromServiceAccount}.firebaseapp.com`,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || projectIdFromServiceAccount,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectIdFromServiceAccount}.appspot.com`,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || ''
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
