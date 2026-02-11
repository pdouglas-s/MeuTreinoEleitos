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

let app, auth, db;

// Só inicializa Firebase se as credenciais essenciais estiverem presentes
const hasRequiredConfig = firebaseConfig.apiKey && firebaseConfig.appId;

if (hasRequiredConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    app = null;
    auth = null;
    db = null;
  }
} else {
  console.warn('Firebase not initialized: missing API key or App ID');
  app = null;
  auth = null;
  db = null;
}

export { app, auth, db };
