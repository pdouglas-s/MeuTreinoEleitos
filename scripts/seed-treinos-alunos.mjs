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

function normalizeCategory(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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
const alunosFilterPrefix = env('SEED_ALUNOS_EMAIL_PREFIX', 'aluno');

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

const treinoTemplates = [
  { nome: 'Treino A - Musculação', categorias: ['peito', 'triceps', 'ombros', 'abdomen'], qtd: 8 },
  { nome: 'Treino B - Musculação', categorias: ['costas', 'biceps', 'abdomen', 'antebraco'], qtd: 8 },
  { nome: 'Treino C - Musculação', categorias: ['pernas', 'gluteos', 'panturrilha', 'abdomen'], qtd: 8 },
  { nome: 'Treino D - Musculação', categorias: ['peito', 'costas', 'pernas', 'ombros', 'biceps', 'triceps'], qtd: 8 }
];

const mainApp = initializeApp(config, 'seed-treinos-main');
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

function pickExercises(exercises, categories, count) {
  const wanted = categories.map(normalizeCategory);
  const byPriority = exercises.filter((item) => wanted.includes(normalizeCategory(item.categoria)));
  const selected = [];
  const usedIds = new Set();

  for (const category of wanted) {
    const candidate = byPriority.find((item) => normalizeCategory(item.categoria) === category && !usedIds.has(item.id));
    if (candidate) {
      selected.push(candidate);
      usedIds.add(candidate.id);
    }
  }

  for (const item of byPriority) {
    if (selected.length >= count) break;
    if (usedIds.has(item.id)) continue;
    selected.push(item);
    usedIds.add(item.id);
  }

  if (selected.length < count) {
    for (const item of exercises) {
      if (selected.length >= count) break;
      if (usedIds.has(item.id)) continue;
      selected.push(item);
      usedIds.add(item.id);
    }
  }

  return selected.slice(0, count);
}

(async () => {
  let professorUid = null;
  let alunosProcessados = 0;
  let treinosCriados = 0;
  let treinosIgnorados = 0;

  try {
    await signInWithEmailAndPassword(mainAuth, adminEmail, adminPassword);
    const adminUid = mainAuth.currentUser?.uid;
    if (!adminUid) throw new Error('Falha ao autenticar admin.');

    const adminSnap = await getDoc(doc(db, 'users', adminUid));
    if (!adminSnap.exists()) throw new Error('Perfil do admin não encontrado em users.');

    const adminData = adminSnap.data() || {};
    if (adminData.role !== 'admin_academia') {
      throw new Error(`Usuário autenticado não é admin_academia (role atual: ${adminData.role || 'indefinido'})`);
    }

    const academiaId = String(adminData.academia_id || '').trim();
    if (!academiaId) throw new Error('admin_academia sem academia_id.');

    const tempEmail = `seed.prof.${Date.now()}@meutreino.com`;
    const tempNome = `SEED PROF ${Date.now()}`;
    professorUid = await createAuthUserWithoutReplacingSession(tempEmail, tempProfessorPassword, 'professor');

    await setDoc(doc(db, 'users', professorUid), {
      nome: tempNome,
      email: tempEmail,
      role: 'professor',
      academia_id: academiaId,
      primeiro_acesso: true
    });

    await signOut(mainAuth);
    await signInWithEmailAndPassword(mainAuth, tempEmail, tempProfessorPassword);

    const alunosSnap = await getDocs(query(
      collection(db, 'users'),
      where('role', '==', 'aluno'),
      where('academia_id', '==', academiaId)
    ));

    const alunos = alunosSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => String(a.email || '').toLowerCase().startsWith(alunosFilterPrefix.toLowerCase()));

    if (!alunos.length) {
      console.log('⚠️ Nenhum aluno encontrado para o filtro informado.');
      return;
    }

    const exerciciosPadraoSnap = await getDocs(query(collection(db, 'exercicios'), where('is_padrao', '==', true)));
    const exerciciosPadrao = exerciciosPadraoSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const exercicios = exerciciosPadrao.length
      ? exerciciosPadrao
      : (await getDocs(collection(db, 'exercicios'))).docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!exercicios.length) {
      throw new Error('Nenhum exercício encontrado na base para compor os treinos.');
    }

    for (const aluno of alunos) {
      alunosProcessados += 1;

      const treinosAlunoSnap = await getDocs(query(
        collection(db, 'treinos'),
        where('aluno_id', '==', aluno.id),
        where('academia_id', '==', academiaId)
      ));

      const nomesExistentes = new Set(
        treinosAlunoSnap.docs.map((d) => String(d.data()?.nome_treino || '').trim().toLowerCase())
      );

      for (const template of treinoTemplates) {
        const nomeTreino = template.nome;
        const chaveNome = nomeTreino.toLowerCase();

        if (nomesExistentes.has(chaveNome)) {
          treinosIgnorados += 1;
          continue;
        }

        const treinoRef = await addDoc(collection(db, 'treinos'), {
          aluno_id: aluno.id,
          professor_id: professorUid,
          nome_treino: nomeTreino,
          ativo: true,
          academia_id: academiaId,
          is_padrao: false,
          origem_padrao: false,
          bloqueado_exclusao: false
        });

        const selectedExercises = pickExercises(exercicios, template.categorias, template.qtd);

        for (const exercicio of selectedExercises) {
          await addDoc(collection(db, 'treino_itens'), {
            treino_id: treinoRef.id,
            exercicio_id: exercicio.id,
            exercicio_nome: exercicio.nome,
            series: Number(exercicio.series_padrao || 3),
            repeticoes: Number(exercicio.repeticoes_padrao || 12),
            carga: exercicio.carga_padrao || 'Livre',
            descanso: '60s'
          });
        }

        treinosCriados += 1;
        nomesExistentes.add(chaveNome);
      }

      console.log(`✅ ${aluno.nome || aluno.email}: processado`);
    }

    console.log(`\n🎯 Concluído. Alunos: ${alunosProcessados} | Treinos criados: ${treinosCriados} | Treinos já existentes: ${treinosIgnorados}`);
    console.log(`👤 Professor técnico criado: ${tempEmail}`);
  } catch (err) {
    console.error('❌ Seed de treinos falhou:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await signOut(mainAuth).catch(() => {});
    await deleteApp(mainApp).catch(() => {});
  }
})();
