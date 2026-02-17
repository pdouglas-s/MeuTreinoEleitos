import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import Constants from 'expo-constants';

// Preferência: usar variáveis de ambiente para não expor segredos no código.
// Se estiver trabalhando localmente e não tiver as variáveis, preenchimentos
// derivados do arquivo de service account (somente campos públicos) foram
// inseridos abaixo para conveniência. NÃO comite credenciais sensíveis.

// Valores sensíveis devem sempre vir de variáveis de ambiente.
const projectIdFromServiceAccount = 'meu-treino-eleitos'; // extraído de meu-treino-eleitos-firebase-adminsdk-*.json

function readPublicEnv(name) {
  const extraValue = Constants.expoConfig?.extra?.[name];
  const envValue = process?.env?.[name];
  return extraValue || envValue || '';
}

const projectId = readPublicEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID') || projectIdFromServiceAccount;

const firebaseConfig = {
  apiKey: readPublicEnv('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: readPublicEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN') || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: readPublicEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET') || `${projectId}.appspot.com`,
  messagingSenderId: readPublicEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readPublicEnv('EXPO_PUBLIC_FIREBASE_APP_ID')
};

let app, auth, db, functions;

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
    functions = getFunctions(app, 'us-central1');
    
    // Configurar persistência de autenticação (mantém usuário logado)
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('✅ Persistência de autenticação configurada');
      })
      .catch((error) => {
        console.warn('⚠️ Erro ao configurar persistência:', error);
      });
    
    console.log('✅ Firebase inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
    app = null;
    auth = null;
    db = null;
    functions = null;
  }
} else {
  console.warn('⚠️ Firebase NÃO inicializado: faltam API Key ou App ID');
  app = null;
  auth = null;
  db = null;
  functions = null;
}

export { app, auth, db, functions };
