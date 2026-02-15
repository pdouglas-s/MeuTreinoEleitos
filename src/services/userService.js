import { auth, db } from '../firebase/config';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getAuth, signOut } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import Constants from 'expo-constants';
import { isValidEmail, normalizeEmail } from '../utils/validation';

function getFirebaseClientConfig() {
  const extra = Constants.expoConfig?.extra || {};
  const projectId = extra.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'meu-treino-eleitos';

  return {
    apiKey: extra.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: extra.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: extra.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    messagingSenderId: extra.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: extra.EXPO_PUBLIC_FIREBASE_APP_ID || ''
  };
}

function getDefaultPasswordByRole(role) {
  const extra = Constants.expoConfig?.extra || {};
  if (role === 'professor') {
    return extra.DEFAULT_TEACHER_PASSWORD || extra.DEFAULT_STUDENT_PASSWORD || '';
  }
  return extra.DEFAULT_STUDENT_PASSWORD || '';
}

async function isCurrentUserAdmin() {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return false;
  const data = snapshot.data();
  const nomeNormalizado = String(data?.nome || '').trim().toUpperCase();
  return data?.role === 'professor' && nomeNormalizado === 'ADMIN';
}

async function createAuthUserWithoutReplacingSession(email, password) {
  const secondaryAppName = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(getFirebaseClientConfig(), secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return userCred.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
}

// Cria um usuário aluno e registra no Firestore conforme schema
export async function createAluno({ nome, email }) {
  const defaultPassword = getDefaultPasswordByRole('aluno');
  console.log('createAluno - defaultPassword configured:', !!defaultPassword);
  
  if (!defaultPassword) throw new Error('DEFAULT_STUDENT_PASSWORD não configurada');
  
  // Remover espaços e converter nome para MAIÚSCULO
  const nomeUpperCase = nome.trim().toUpperCase();
  const emailNormalizado = normalizeEmail(email);

  if (!isValidEmail(emailNormalizado)) {
    throw new Error('E-mail inválido');
  }
  
  // Impedir criação de ADMIN por este método
  if (nomeUpperCase === 'ADMIN') {
    throw new Error('Não é possível criar ADMIN através deste método. Use o registro normal.');
  }

  const userCred = await createUserWithEmailAndPassword(auth, emailNormalizado, defaultPassword);
  const uid = userCred.user.uid;

  await setDoc(doc(db, 'users', uid), {
    nome: nomeUpperCase,
    email: emailNormalizado,
    role: 'aluno',
    primeiro_acesso: true
  });

  return { uid };
}

// Registra um novo usuário (professor ou aluno)
// REGRA: Apenas nome "ADMIN" pode ser professor, demais são sempre alunos
// Nome sempre convertido para MAIÚSCULO para garantir unicidade
export async function registerUser({ nome, email, password, role }) {
  console.log('registerUser called with:', { nome, email, role, hasPassword: !!password });
  
  // Remover espaços e converter nome para MAIÚSCULO
  const nomeUpperCase = nome.trim().toUpperCase();
  const emailNormalizado = normalizeEmail(email);

  if (!isValidEmail(emailNormalizado)) {
    throw new Error('E-mail inválido');
  }
  
  // Determinar role automaticamente: somente "ADMIN" é professor
  const roleAutomatica = nomeUpperCase === 'ADMIN' ? 'professor' : 'aluno';
  console.log(`Role determinada automaticamente: ${roleAutomatica} (nome: ${nomeUpperCase})`);
  
  try {
    // Primeiro cria a conta no Firebase Auth
    const userCred = await createUserWithEmailAndPassword(auth, emailNormalizado, password);
    const uid = userCred.user.uid;
    console.log('User created in Auth:', uid);

    // Se for ADMIN, verificar se já existe (agora usuário está autenticado)
    if (nomeUpperCase === 'ADMIN') {
      const adminLockRef = doc(db, 'system', 'admin_lock');
      const adminLockSnap = await getDoc(adminLockRef);
      
      if (adminLockSnap.exists()) {
        // Já existe ADMIN, deletar conta recém criada e lançar erro
        await userCred.user.delete();
        throw new Error('Já existe um administrador cadastrado no sistema. Apenas um ADMIN é permitido.');
      }
      
      // Criar documento de lock ANTES de criar o perfil
      await setDoc(adminLockRef, {
        admin_uid: uid,
        created_at: new Date(),
        email: emailNormalizado
      });
    }

    // Criar perfil no Firestore
    await setDoc(doc(db, 'users', uid), {
      nome: nomeUpperCase,
      email: emailNormalizado,
      role: roleAutomatica,
      primeiro_acesso: false
    });
    console.log('User profile created in Firestore');

    return { uid };
  } catch (error) {
    console.error('Error in registerUser:', error);
    throw error;
  }
}

export async function createProfessor({ nome, email }) {
  const defaultPassword = getDefaultPasswordByRole('professor');
  if (!defaultPassword) throw new Error('DEFAULT_TEACHER_PASSWORD ou DEFAULT_STUDENT_PASSWORD não configurada');

  const admin = await isCurrentUserAdmin();
  if (!admin) throw new Error('Apenas ADMIN pode criar professor');

  const nomeUpperCase = nome.trim().toUpperCase();
  const emailNormalizado = normalizeEmail(email);
  if (!nomeUpperCase) throw new Error('Nome é obrigatório');
  if (!isValidEmail(emailNormalizado)) throw new Error('E-mail inválido');

  const uid = await createAuthUserWithoutReplacingSession(emailNormalizado, defaultPassword);

  await setDoc(doc(db, 'users', uid), {
    nome: nomeUpperCase,
    email: emailNormalizado,
    role: 'professor',
    primeiro_acesso: true
  });

  return { uid };
}

export async function listAllProfessores() {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, where('role', '==', 'professor'));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
}

export async function deleteProfessorProfile(professorId) {
  const admin = await isCurrentUserAdmin();
  if (!admin) throw new Error('Apenas ADMIN pode excluir professor');

  const ref = doc(db, 'users', professorId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Professor não encontrado');

  const data = snap.data();
  if (data.role !== 'professor') {
    throw new Error('O usuário informado não é professor');
  }
  if (data.nome === 'ADMIN') {
    throw new Error('Não é permitido excluir o ADMIN principal');
  }

  const emailNormalizado = normalizeEmail(data.email || '');
  if (emailNormalizado) {
    await setDoc(doc(db, 'emails_bloqueados', emailNormalizado), {
      email: emailNormalizado,
      blocked_at: serverTimestamp(),
      blocked_by: auth.currentUser?.uid || null,
      reason: 'professor_deleted_firestore_only'
    }, { merge: true });
  }

  await deleteDoc(ref);
}

export async function unblockBlockedEmail(email) {
  const admin = await isCurrentUserAdmin();
  if (!admin) throw new Error('Apenas ADMIN pode desbloquear e-mail');

  const emailNormalizado = normalizeEmail(email);
  if (!isValidEmail(emailNormalizado)) throw new Error('E-mail inválido');

  const ref = doc(db, 'emails_bloqueados', emailNormalizado);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    throw new Error('E-mail não está bloqueado');
  }

  await deleteDoc(ref);
}

export async function login({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const snapshot = await getDoc(doc(db, 'users', uid));
  const data = snapshot.exists() ? snapshot.data() : null;
  return { uid, profile: data };
}

export async function changePassword(newPassword) {
  if (!auth.currentUser) throw new Error('Usuário não autenticado');
  await updatePassword(auth.currentUser, newPassword);
}

export async function setPrimeiroAcessoFalse(uid) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { primeiro_acesso: false });
}

// Listar todos os alunos (para professores)
export async function listAllAlunos() {
  const usersCol = collection(db, 'users');
  const q = query(usersCol, where('role', '==', 'aluno'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
