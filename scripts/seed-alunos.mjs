import 'dotenv/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

const config = {
  apiKey: env('EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: env('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', `${env('EXPO_PUBLIC_FIREBASE_PROJECT_ID')}.firebaseapp.com`),
  projectId: env('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: env('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', `${env('EXPO_PUBLIC_FIREBASE_PROJECT_ID')}.appspot.com`),
  messagingSenderId: env('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('EXPO_PUBLIC_FIREBASE_APP_ID')
};

const adminEmail = env('SEED_ADMIN_EMAIL');
const adminPassword = env('SEED_ADMIN_PASSWORD');
const defaultStudentPassword = env('DEFAULT_STUDENT_PASSWORD', 'Mudar@123');
const total = Number(env('SEED_ALUNOS_TOTAL', '10'));
const emailDomain = env('SEED_ALUNOS_DOMAIN', 'meutreino.app');
const emailPrefix = env('SEED_ALUNOS_PREFIX', 'aluno');
const nomePrefix = env('SEED_ALUNOS_NOME_PREFIX', 'ALUNO');

if (!config.apiKey || !config.projectId || !config.appId) {
  console.error('❌ Firebase config incompleta no .env');
  process.exit(1);
}

if (!adminEmail || !adminPassword) {
  console.error('❌ Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD para autenticar.');
  process.exit(1);
}

if (!defaultStudentPassword) {
  console.error('❌ DEFAULT_STUDENT_PASSWORD não definida.');
  process.exit(1);
}

const mainApp = initializeApp(config, 'seed-main');
const mainAuth = getAuth(mainApp);
const db = getFirestore(mainApp);

async function createAuthUserWithoutReplacingSession(email, password, index) {
  const secondaryAppName = `seed-secondary-${Date.now()}-${index}`;
  const secondaryApp = initializeApp(config, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return cred.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
}

function twoDigits(n) {
  return String(n).padStart(2, '0');
}

(async () => {
  let created = 0;
  let skipped = 0;

  try {
    await signInWithEmailAndPassword(mainAuth, adminEmail, adminPassword);

    const uid = mainAuth.currentUser?.uid;
    if (!uid) throw new Error('Falha ao autenticar admin.');

    const adminSnap = await getDoc(doc(db, 'users', uid));
    if (!adminSnap.exists()) throw new Error('Perfil do admin não encontrado em users.');

    const adminData = adminSnap.data() || {};
    if (adminData.role !== 'admin_academia') {
      throw new Error(`Usuário autenticado não é admin_academia (role atual: ${adminData.role || 'indefinido'})`);
    }

    const academiaId = String(adminData.academia_id || '').trim();
    if (!academiaId) throw new Error('admin_academia sem academia_id no perfil.');

    for (let i = 1; i <= total; i += 1) {
      const sufixo = twoDigits(i);
      const nome = `${nomePrefix} ${sufixo}`;
      const email = `${emailPrefix}${sufixo}.seed@${emailDomain}`.toLowerCase();

      try {
        const newUid = await createAuthUserWithoutReplacingSession(email, defaultStudentPassword, i);
        await setDoc(doc(db, 'users', newUid), {
          nome,
          email,
          role: 'aluno',
          academia_id: academiaId,
          primeiro_acesso: true
        });
        created += 1;
        console.log(`✅ Criado: ${nome} <${email}>`);
      } catch (err) {
        const code = String(err?.code || '');
        if (code.includes('email-already-in-use')) {
          skipped += 1;
          console.log(`⏭️  Já existe: ${email}`);
          continue;
        }
        throw err;
      }
    }

    console.log(`\n🎯 Concluído. Criados: ${created} | Já existentes: ${skipped}`);
  } catch (err) {
    console.error('❌ Seed falhou:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await signOut(mainAuth).catch(() => {});
    await deleteApp(mainApp).catch(() => {});
  }
})();
