import 'dotenv/config';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  setPersistence,
  inMemoryPersistence
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc
} from 'firebase/firestore';

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
const tempProfessorPassword = env('SEED_TEMP_PROF_PASSWORD', env('DEFAULT_STUDENT_PASSWORD', 'Mudar@123'));
const tempAlunoPassword = env('SEED_TEMP_ALUNO_PASSWORD', 'Aluno@123');

if (!config.apiKey || !config.projectId || !config.appId) {
  console.error('❌ Firebase config incompleta no .env');
  process.exit(1);
}
if (!adminEmail || !adminPassword) {
  console.error('❌ Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD.');
  process.exit(1);
}
if (!tempProfessorPassword) {
  console.error('❌ Defina SEED_TEMP_PROF_PASSWORD ou DEFAULT_STUDENT_PASSWORD.');
  process.exit(1);
}

const mainApp = initializeApp(config, 'seed-multi-academias');
const mainAuth = getAuth(mainApp);
const db = getFirestore(mainApp);

async function createAuthUserWithoutReplacingSession(email, password, tag) {
  const secondaryApp = initializeApp(config, `seed-secondary-${Date.now()}-${tag}`);
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

async function main() {
  try {
    await signInWithEmailAndPassword(mainAuth, adminEmail, adminPassword);
    const adminUid = mainAuth.currentUser?.uid;
    if (!adminUid) throw new Error('Falha ao autenticar admin.');

    // Criar 10 academias
    const academiaIds = [];
    for (let i = 1; i <= 10; i++) {
      const academiaId = `academia_${i}`;
      await setDoc(doc(db, 'academias', academiaId), {
        nome: `Academia ${i}`,
        endereco: `Rua ${i} - Centro`,
        criada_em: new Date().toISOString(),
        admin_uid: adminUid
      });
      academiaIds.push(academiaId);
    }

    // Para cada academia, criar 10 professores
    for (const academiaId of academiaIds) {
      for (let j = 1; j <= 10; j++) {
        const profEmail = `prof_${academiaId}_${j}@meutreino.com`;
        const profNome = `Professor ${j} - ${academiaId}`;
        const profUid = await createAuthUserWithoutReplacingSession(profEmail, tempProfessorPassword, `prof-${academiaId}-${j}`);
        await setDoc(doc(db, 'users', profUid), {
          nome: profNome,
          email: profEmail,
          role: 'professor',
          academia_id: academiaId,
          primeiro_acesso: true
        });
        // Para cada professor, criar 5 alunos
        for (let k = 1; k <= 5; k++) {
          const alunoEmail = `aluno_${academiaId}_${j}_${k}@meutreino.com`;
          const alunoNome = `Aluno ${k} - Prof ${j} - ${academiaId}`;
          const alunoUid = await createAuthUserWithoutReplacingSession(alunoEmail, tempAlunoPassword, `aluno-${academiaId}-${j}-${k}`);
          await setDoc(doc(db, 'users', alunoUid), {
            nome: alunoNome,
            email: alunoEmail,
            role: 'aluno',
            academia_id: academiaId,
            primeiro_acesso: true
          });
          // Para cada aluno, criar 3 treinos
          for (let t = 1; t <= 3; t++) {
            const treinoRef = await addDoc(collection(db, 'treinos'), {
              aluno_id: alunoUid,
              professor_id: profUid,
              nome_treino: `Treino ${t} - ${alunoNome}`,
              ativo: true,
              academia_id: academiaId,
              is_padrao: false,
              origem_padrao: false,
              bloqueado_exclusao: false
            });
            // Adicionar 5 itens de treino (exercícios fictícios)
            for (let e = 1; e <= 5; e++) {
              await addDoc(collection(db, 'treino_itens'), {
                treino_id: treinoRef.id,
                exercicio_id: `exercicio_${e}`,
                exercicio_nome: `Exercicio ${e}`,
                series: 3,
                repeticoes: 12,
                carga: 'Livre',
                descanso: '60s'
              });
            }
          }
        }
      }
    }
    console.log('✅ Seed multi-academias concluído com sucesso!');
  } catch (err) {
    console.error('❌ Seed multi-academias falhou:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await signOut(mainAuth).catch(() => {});
    await deleteApp(mainApp).catch(() => {});
  }
}

main();
