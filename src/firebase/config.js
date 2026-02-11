import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import Constants from 'expo-constants';

// Preferência: usar variáveis de ambiente para não expor segredos no código.
// Se estiver trabalhando localmente e não tiver as variáveis, preenchimentos
// derivados do arquivo de service account (somente campos públicos) foram
// inseridos abaixo para conveniência. NÃO comite credenciais sensíveis.

// Valores sensíveis devem sempre vir de variáveis de ambiente.
const projectIdFromServiceAccount = 'meu-treino-eleitos'; // extraído de meu-treino-eleitos-firebase-adminsdk-*.json

// Pegar variáveis do expo-constants (funciona em Web, iOS e Android)
const extra = Constants.expoConfig?.extra || {};

const firebaseConfig = {
  apiKey: extra.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: extra.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectIdFromServiceAccount}.firebaseapp.com`,
  projectId: extra.EXPO_PUBLIC_FIREBASE_PROJECT_ID || projectIdFromServiceAccount,
  storageBucket: extra.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectIdFromServiceAccount}.appspot.com`,
  messagingSenderId: extra.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: extra.EXPO_PUBLIC_FIREBASE_APP_ID || ''
};

let app, auth, db;

// Debug: Mostrar status das variáveis de ambiente
console.log('=== FIREBASE CONFIG DEBUG ===');
console.log('API Key presente:', !!firebaseConfig.apiKey);
console.log('App ID presente:', !!firebaseConfig.appId);
console.log('Project ID:', firebaseConfig.projectId);
console.log('Auth Domain:', firebaseConfig.authDomain);
console.log('============================');

// Só inicializa Firebase se as credenciais essenciais estiverem presentes
const hasRequiredConfig = firebaseConfig.apiKey && firebaseConfig.appId;

if (hasRequiredConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('✅ Firebase inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
    app = null;
    auth = null;
    db = null;
  }
} else {
  console.warn('⚠️ Firebase NÃO inicializado: faltam API Key ou App ID');
  app = null;
  auth = null;
  db = null;
}

export { app, auth, db };
